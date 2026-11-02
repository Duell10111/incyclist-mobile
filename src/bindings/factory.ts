import { Platform } from "react-native"
import { getBindings, IncyclistBindings, withExternalFileAccess } from "incyclist-services"
import { getLogBinding } from "./logging"
import { getAppInfoBinding } from "./appInfo"
import { getUserSettingsBinding } from "./user-settings"
import { getSecretBinding } from "./secret"
import { getMessageQueueBinding } from "./mq"
import { getDirectConnectBinding } from "./direct-connect"
import { getBleBinding } from "./ble"
import { getUIBinding } from "./ui"
import { getFileSystemBinding } from "./fs"
import { getPathBinding } from "./path"
import { getVideoBinding } from "./video"
import { getRepositoryBinding } from "./db"
import { getFileLoaderBinding } from "./loader"
import { getCryptoBinding } from "./crypto"
import { getFetchBinding } from "./fetch"
import { getFormBinding } from './form';
import { MobileDownloadManager } from './download';
import { getMapAvailabilityBinding } from './mapAvailability';
import { getFileAccessBinding } from './fileAccess';
import { getSerialBinding } from './serial';


let _bindings:IncyclistBindings|undefined

export const initBindings = async  ()=> {

    // should only be called once
    if (_bindings) {
        return _bindings
    }

    const bindings = getBindings()


    bindings.logging = getLogBinding()
    bindings.appInfo = await getAppInfoBinding()
    bindings.settings = getUserSettingsBinding()
    bindings.secret = getSecretBinding()
    bindings.mq = getMessageQueueBinding()
    bindings.wifi = getDirectConnectBinding() 
    bindings.ble = getBleBinding()
    bindings.ui = getUIBinding()
    bindings.fs = getFileSystemBinding()
    bindings.path = getPathBinding()
    bindings.video = getVideoBinding()
    bindings.db = getRepositoryBinding()
    bindings.loader = getFileLoaderBinding()
    bindings.crypto = getCryptoBinding()
    bindings.fetch = getFetchBinding()
    bindings.form = getFormBinding()
    bindings.downloadManager = new MobileDownloadManager()

    // Access to files outside the app sandbox (iCloud/picked folders). iOS only - there is no
    // Android or web-ui/desktop implementation, so the binding stays absent everywhere else.
    // The loader is wrapped so a route-file read waits for an iCloud download first; on other
    // platforms bindings.loader stays exactly what getFileLoaderBinding() returned above.
    if (Platform.OS === 'ios') {
        // serial interface backed by External Accessory sessions (e.g. Kettler Racer S)
        bindings.serial = getSerialBinding()
        bindings.fileAccess = getFileAccessBinding()
        bindings.loader = withExternalFileAccess(bindings.loader)
    }

    // Gates which ride views are offered and which are safe to render. Its own check runs
    // asynchronously in the background from here - nothing waits on it.
    const mapAvailability = getMapAvailabilityBinding()
    mapAvailability.start()
    bindings.mapAvailability = mapAvailability

    
    // bindings.form = FormPostBinding.getInstance()
    // bindings.crypto = getCryptoBinding()
    // bindings.outh = OAuthBinding.getInstance()

    _bindings = bindings
    return bindings
    
}