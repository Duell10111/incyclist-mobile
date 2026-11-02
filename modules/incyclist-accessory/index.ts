import { NativeModule, requireOptionalNativeModule } from 'expo';

export type AccessoryInfo = {
    connectionId: number;
    name: string;
    manufacturer: string;
    modelNumber: string;
    serialNumber: string;
    firmwareRevision: string;
    hardwareRevision: string;
};

type IncyclistAccessoryEvents = {
    /** data received on a session (base64) */
    onData: (event: { sessionId: number; data: string }) => void;
    /** session ended by the accessory or by a stream error */
    onClose: (event: { sessionId: number; error?: string }) => void;
    /** an accessory was connected or disconnected */
    onAccessoriesChanged: () => void;
};

declare class IncyclistAccessoryModule extends NativeModule<IncyclistAccessoryEvents> {
    /** connected External Accessory (MFi) accessories that support the protocol */
    list(protocolString: string): AccessoryInfo[];
    /** opens a session, resolves with the session id */
    open(connectionId: number, protocolString: string): Promise<number>;
    /** writes base64 encoded data */
    write(sessionId: number, base64: string): Promise<void>;
    close(sessionId: number): Promise<void>;
}

// optional: iOS only, and binaries older than this module don't contain it
export default requireOptionalNativeModule<IncyclistAccessoryModule>('IncyclistAccessory');
