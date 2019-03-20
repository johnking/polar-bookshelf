import {PersistenceLayer} from '../../datastore/PersistenceLayer';
import {PDFImporter} from '../repository/importers/PDFImporter';
import {IProvider} from '../../util/Providers';
import {FilePaths} from '../../util/FilePaths';
import base = Mocha.reporters.base;
import {ImportedFile} from '../repository/importers/PDFImporter';
import {Optional} from '../../util/ts/Optional';
import {AddContentButtonOverlays} from './AddContentButtonOverlays';
import {Latches} from '../../util/Latches';
import {Latch} from '../../util/Latch';
import {ListenablePersistenceLayer} from '../../datastore/ListenablePersistenceLayer';
import {InjectedComponent} from '../../ui/util/ReactInjector';
import {Toaster} from '../../ui/toaster/Toaster';
import {PreviewURLs} from './PreviewURLs';
import {AuthHandlers} from '../repository/auth_handler/AuthHandler';
import {LoginURLs} from './LoginURLs';
import {log} from 'util';

export interface AddContentImporter {

    /**
     * Perform anys setup.
     */
    prepare(): Promise<void>;

    /**
     * Do the actual import.
     */
    doImport(persistenceLayerProvider: IProvider<ListenablePersistenceLayer>): Promise<Optional<ImportedFile>>;

}

/**
 * Handles any issues with importing content into Polar
 */
export class DefaultAddContentImporter  implements AddContentImporter {

    // create a latch so that we can block the model until the
    // document was added.
    private latch = new Latch<boolean>();

    private overlay?: InjectedComponent;

    public async prepare(): Promise<void> {

        if (PreviewURLs.isAutoAdd()) {

            // the user is now auto-adding this URL so we don't need to prompt.
            this.latch.resolve(true);

        } else {

            const authenticated = await this.isAuthenticated();

            this.overlay = await AddContentButtonOverlays.create(() => {

                if (authenticated) {

                    // resolve the latch so we can move forward.
                    this.latch.resolve(true);

                } else {

                    // If we aren't logged in here, we need to redirect to the
                    // proper login path and create an auto-add URL

                    const successURL = PreviewURLs.createAutoAdd(document.location!.href);
                    const loginURL = LoginURLs.create(successURL);

                    document.location!.href = loginURL;

                }

            });

        }

        // we have to await our own latch here so to fully wait until the user
        // has asked to add because after this we might do other things like
        // init the datastore.
        await this.latch.get();

    }

    public async doImport(persistenceLayerProvider: IProvider<ListenablePersistenceLayer>): Promise<Optional<ImportedFile>> {

        try {

            Toaster.info("Importing file into Polar document repository...");

            await this.latch.get();

            if (this.overlay) {
                this.overlay.destroy();
            }

            const url = this.getURL();

            const basename = FilePaths.basename(url);
            const response = await fetch(url);
            const blob = await response.blob();
            const blobURL = URL.createObjectURL(blob);

            const pdfImporter = new PDFImporter(persistenceLayerProvider);

            const importedFile = await pdfImporter.importFile(blobURL, basename);

            importedFile.map(this.updateURL);

            Toaster.success('File successfully added to document repository');

            return importedFile;

        } catch (e) {
            Toaster.error('Unable to add to document repository: ' + e.message);
            throw e;
        }

    }

    private async isAuthenticated(): Promise<boolean> {

        const authHandler = AuthHandlers.get();

        const userInfo = await authHandler.userInfo();

        return userInfo.isPresent();

    }

    private updateURL(importedFile: ImportedFile) {

        const url = new URL(document.location!.href);
        url.searchParams.delete('preview');
        url.searchParams.set('filename', importedFile.fileRef.name);

        history.pushState({}, document.title, url.toString());

    }

    private getURL() {
        const url = new URL(document.location!.href);
        return url.searchParams.get('file')!;
    }

}

export class NullAddContentImporter implements AddContentImporter {

    public async prepare(): Promise<void> {
        // noop
    }

    public async doImport(persistenceLayerProvider: IProvider<ListenablePersistenceLayer>): Promise<Optional<ImportedFile>> {
        return Optional.empty();
    }

}