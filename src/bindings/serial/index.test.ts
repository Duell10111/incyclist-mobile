const mockConfig = {
    getInterfaceSettings: jest.fn(),
    setInterfaceSettings: jest.fn(),
}

jest.mock('incyclist-services', () => ({
    useDeviceConfiguration: () => mockConfig,
}))

import { selectSerialProtocol, SERIAL_PROTOCOL } from './index'

describe('selectSerialProtocol', () => {
    beforeEach(() => {
        mockConfig.getInterfaceSettings.mockReset()
        mockConfig.setInterfaceSettings.mockReset()
    })

    it('replaces the services default protocol by Kettler Racer', () => {
        mockConfig.getInterfaceSettings.mockReturnValue({ name: 'serial', enabled: true, protocol: 'Daum Classic' })
        selectSerialProtocol()
        expect(mockConfig.setInterfaceSettings).toHaveBeenCalledWith('serial', { name: 'serial', enabled: true, protocol: SERIAL_PROTOCOL })
    })

    it('does nothing if Kettler Racer is already selected', () => {
        mockConfig.getInterfaceSettings.mockReturnValue({ name: 'serial', enabled: true, protocol: SERIAL_PROTOCOL })
        selectSerialProtocol()
        expect(mockConfig.setInterfaceSettings).not.toHaveBeenCalled()
    })

    it('does nothing if the serial interface is not configured', () => {
        mockConfig.getInterfaceSettings.mockReturnValue(undefined)
        selectSerialProtocol()
        expect(mockConfig.setInterfaceSettings).not.toHaveBeenCalled()
    })
})
