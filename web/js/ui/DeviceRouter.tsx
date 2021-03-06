import * as React from 'react';
import {Device, Devices} from "../util/Devices";

export class DeviceRouter extends React.Component<IProps> {

    private readonly device: Device;

    constructor(props: IProps, context: any) {
        super(props, context);
        this.device = Devices.get();
    }

    public render() {

        switch (this.device) {

            case "phone":
                return this.props.phone || null;
            case "tablet":
                return this.props.tablet || null;
            case "desktop":
                return this.props.desktop || null;

        }

    }

}

export interface IProps {

    readonly phone?: React.ReactElement | null;

    readonly tablet?: React.ReactElement | null;

    readonly desktop?: React.ReactElement | null;

}
