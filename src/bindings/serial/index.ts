import { useDeviceConfiguration } from 'incyclist-services'
import { createExternalAccessoryBinding } from './ea-binding'

/** The only serial protocol reachable on iOS (External Accessory devices): Kettler Racer S */
export const SERIAL_PROTOCOL = 'Kettler Racer'

/**
 * Serial interface binding factory as expected by incyclist-services (`bindings.serial`).
 *
 * Only the 'serial' interface is backed, by External Accessory sessions (iOS only). Returns undefined
 * where no binding is available, so the interface stays unusable as before.
 */
export const getSerialBinding = () => ({
    getSerialBinding: (ifName: string) => ifName === 'serial' ? createExternalAccessoryBinding() ?? undefined : undefined
})

/**
 * The mobile UI has no protocol selection for the serial interface, and incyclist-services defaults to
 * 'Daum Classic'. Must be called once the device configuration is initialized (after onAppLaunch).
 */
export const selectSerialProtocol = () => {
    const config = useDeviceConfiguration()
    const settings = config.getInterfaceSettings('serial')
    if (settings && settings.protocol !== SERIAL_PROTOCOL)
        config.setInterfaceSettings('serial', { ...settings, protocol: SERIAL_PROTOCOL })
}
