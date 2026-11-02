import { Buffer } from 'buffer'
import IncyclistAccessory from '../../../modules/incyclist-accessory'

/**
 * Serial port binding (@serialport/bindings-interface) on top of External Accessory sessions (iOS).
 *
 * iOS apps cannot use Bluetooth Classic serial ports, only MFi accessories via the External Accessory
 * framework. The Kettler Racer S is such an accessory: over a session for its protocol it speaks exactly
 * the protocol incyclist-devices uses over a serial port on desktop.
 *
 * Ports are listed as `ea:<connectionId>`.
 */

export const PATH_PREFIX = 'ea:'

/** External Accessory protocols that are known to carry a serial device protocol */
export const SUPPORTED_PROTOCOLS = ['com.kettler.s-fit']

type NativeAccessoryModule = NonNullable<typeof IncyclistAccessory>

type Subscription = { remove: () => void }

type PortInfo = {
    path: string
    manufacturer?: string
    serialNumber?: string
    pnpId?: string
    locationId?: string
    productId?: string
    vendorId?: string
}

type OpenOptions = {
    path: string
    baudRate?: number
}

const resolveNextTick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

class CanceledError extends Error {
    canceled = true
}

export class ExternalAccessoryPortBinding {
    protected data: Buffer = Buffer.alloc(0)
    protected pendingRead: ((err?: Error) => void) | null = null
    protected closed = false
    protected subscriptions: Subscription[] = []

    constructor(
        protected readonly native: NativeAccessoryModule,
        protected readonly sessionId: number,
        public readonly openOptions: OpenOptions
    ) {
        this.subscriptions.push(
            native.addListener('onData', ({ sessionId: id, data }) => {
                if (id === this.sessionId)
                    this.onData(Buffer.from(data, 'base64'))
            }),
            native.addListener('onClose', ({ sessionId: id, error }) => {
                if (id === this.sessionId)
                    this.onClosed(error ? new Error(error) : new CanceledError('port is closed'))
            })
        )
    }

    get isOpen(): boolean {
        return !this.closed
    }

    protected onData(buffer: Buffer) {
        this.data = Buffer.concat([this.data, buffer])
        if (this.pendingRead) {
            const pending = this.pendingRead
            this.pendingRead = null
            pending()
        }
    }

    protected onClosed(err: Error) {
        if (this.closed)
            return
        this.closed = true
        this.subscriptions.forEach(s => s.remove())
        this.subscriptions = []
        if (this.pendingRead) {
            const pending = this.pendingRead
            this.pendingRead = null
            pending(err)
        }
    }

    async close(): Promise<void> {
        if (this.closed)
            return
        this.data = Buffer.alloc(0)
        try {
            await this.native.close(this.sessionId)
        }
        finally {
            this.onClosed(new CanceledError('port is closed'))
        }
    }

    async read(buffer: Buffer, offset: number, length: number): Promise<{ buffer: Buffer, bytesRead: number }> {
        if (!this.isOpen)
            throw new Error('Port is not open')
        if (buffer.length < offset + length)
            throw new Error('buffer is too small')

        await resolveNextTick()

        if (this.data.length === 0) {
            if (!this.isOpen)
                throw new CanceledError('port is closed')
            return new Promise((resolve, reject) => {
                this.pendingRead = (err?: Error) => {
                    if (err)
                        return reject(err)
                    this.read(buffer, offset, length).then(resolve, reject)
                }
            })
        }

        const bytesRead = this.data.subarray(0, length).copy(buffer, offset)
        this.data = this.data.subarray(bytesRead)
        return { buffer, bytesRead }
    }

    async write(buffer: Buffer): Promise<void> {
        if (!this.isOpen)
            throw new Error('Port is not open')
        await this.native.write(this.sessionId, Buffer.from(buffer).toString('base64'))
    }

    async update(): Promise<void> {
        await resolveNextTick()
    }

    async set(): Promise<void> {
        await resolveNextTick()
    }

    async get() {
        if (!this.isOpen)
            throw new Error('Port is not open')
        return { cts: true, dsr: false, dcd: false }
    }

    async getBaudRate() {
        return { baudRate: this.openOptions.baudRate ?? 9600 }
    }

    async flush(): Promise<void> {
        if (!this.isOpen)
            throw new Error('Port is not open')
        this.data = Buffer.alloc(0)
    }

    async drain(): Promise<void> {
        if (!this.isOpen)
            throw new Error('Port is not open')
        await resolveNextTick()
    }
}

/**
 * Creates the binding, or returns null if the native module is not available (Android, or an older binary)
 */
export const createExternalAccessoryBinding = (native: NativeAccessoryModule | null = IncyclistAccessory) => {
    if (!native)
        return null

    const findProtocol = (connectionId: number) =>
        SUPPORTED_PROTOCOLS.find(p => native.list(p).some(a => a.connectionId === connectionId))

    return {
        async list(): Promise<PortInfo[]> {
            return SUPPORTED_PROTOCOLS.flatMap(p => native.list(p)).map(accessory => ({
                path: `${PATH_PREFIX}${accessory.connectionId}`,
                manufacturer: accessory.manufacturer,
                serialNumber: accessory.serialNumber || accessory.name
            }))
        },

        async open(options: OpenOptions): Promise<ExternalAccessoryPortBinding> {
            const connectionId = Number(options?.path?.startsWith(PATH_PREFIX) ? options.path.substring(PATH_PREFIX.length) : Number.NaN)
            if (Number.isNaN(connectionId))
                throw new TypeError('"path" is not valid')

            const protocol = findProtocol(connectionId)
            if (!protocol)
                throw new Error(`accessory ${connectionId} is not connected`)

            const sessionId = await native.open(connectionId, protocol)
            return new ExternalAccessoryPortBinding(native, sessionId, options)
        }
    }
}
