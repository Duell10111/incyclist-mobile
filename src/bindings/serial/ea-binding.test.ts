import { EventEmitter } from 'events'

import { createExternalAccessoryBinding, ExternalAccessoryPortBinding } from './ea-binding'

const RACER_S = {
    connectionId: 33334976,
    name: 'KettFit App',
    manufacturer: 'Kettler',
    modelNumber: 'RACER S',
    serialNumber: '',
    firmwareRevision: '1.2.3',
    hardwareRevision: '4.5.6',
}

// stand-in for the Expo module: events are emitted like the native side does
class FakeAccessoryModule extends EventEmitter {
    accessories = [RACER_S]
    written: string[] = []

    list = jest.fn((protocol: string) => protocol === 'com.kettler.s-fit' ? this.accessories : [])
    open = jest.fn(async () => 1)
    write = jest.fn(async (_sessionId: number, base64: string) => { this.written.push(base64) })
    close = jest.fn(async (sessionId: number) => { this.emit('onClose', { sessionId }) })

    addListener(event: string, listener: (...args: any[]) => void): any {
        super.addListener(event, listener)
        return { remove: () => this.removeListener(event, listener) }
    }

    receive(text: string, sessionId = 1) {
        this.emit('onData', { sessionId, data: Buffer.from(text).toString('base64') })
    }
}

describe('External Accessory serial binding', () => {
    let native: FakeAccessoryModule
    let binding: NonNullable<ReturnType<typeof createExternalAccessoryBinding>>

    beforeEach(() => {
        native = new FakeAccessoryModule()
        binding = createExternalAccessoryBinding(native as any)!
    })

    const open = () => binding.open({ path: 'ea:33334976' })

    it('is not available without the native module', () => {
        expect(createExternalAccessoryBinding(null)).toBeNull()
    })

    it('lists accessories of supported protocols', async () => {
        expect(await binding.list()).toEqual([{ path: 'ea:33334976', manufacturer: 'Kettler', serialNumber: 'KettFit App' }])
    })

    it('opens a session for the protocol of the accessory', async () => {
        const port = await open()
        expect(native.open).toHaveBeenCalledWith(33334976, 'com.kettler.s-fit')
        expect(port.isOpen).toBe(true)
    })

    it('rejects invalid paths and accessories that are not connected', async () => {
        await expect(binding.open({ path: '/dev/cu.RACERS' })).rejects.toThrow('"path" is not valid')
        await expect(binding.open({ path: 'ea:1' })).rejects.toThrow('accessory 1 is not connected')
    })

    it('writes base64 encoded data', async () => {
        const port = await open()
        await port.write(Buffer.from('ID\r\n'))
        expect(native.written).toEqual([Buffer.from('ID\r\n').toString('base64')])
    })

    it('reads received data, waiting for it if needed', async () => {
        const port = await open()
        const read = port.read(Buffer.alloc(64), 0, 64)
        setTimeout(() => native.receive('EA10S1801\r\n'), 5)

        const { buffer, bytesRead } = await read
        expect(buffer.subarray(0, bytesRead).toString()).toBe('EA10S1801\r\n')
    })

    it('ignores data of other sessions', async () => {
        const port = await open()
        native.receive('other', 2)
        native.receive('mine')
        const { buffer, bytesRead } = await port.read(Buffer.alloc(64), 0, 64)
        expect(buffer.subarray(0, bytesRead).toString()).toBe('mine')
    })

    it('returns at most length bytes and keeps the rest', async () => {
        const port = await open()
        native.receive('ACK\r\n')
        const first = await port.read(Buffer.alloc(3), 0, 3)
        const second = await port.read(Buffer.alloc(64), 0, 64)
        expect(first.buffer.subarray(0, first.bytesRead).toString()).toBe('ACK')
        expect(second.buffer.subarray(0, second.bytesRead).toString()).toBe('\r\n')
    })

    it('cancels a pending read when the accessory closes the session', async () => {
        const port = await open()
        const read = port.read(Buffer.alloc(64), 0, 64)
        await new Promise(done => setTimeout(done, 5))
        native.emit('onClose', { sessionId: 1, error: 'stream error' })

        await expect(read).rejects.toThrow('stream error')
        expect(port.isOpen).toBe(false)
    })

    it('close ends the session and removes the listeners', async () => {
        const port: ExternalAccessoryPortBinding = await open()
        await port.close()
        expect(native.close).toHaveBeenCalledWith(1)
        expect(port.isOpen).toBe(false)
        expect(native.listenerCount('onData')).toBe(0)
        await expect(port.write(Buffer.from('ID'))).rejects.toThrow('Port is not open')
    })
})
