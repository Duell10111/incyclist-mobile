import {
    AppState,
    Platform,
    StatusBar,
    useColorScheme,
    BackHandler,
    useWindowDimensions,
    LogBox,
    StyleSheet,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PropsWithChildren, ReactElement, useEffect, useRef, useState } from 'react';
import { AppFeatures, IncyclistBindings } from 'incyclist-services';
import { ApiConfiguration, flushLogs, useIncyclist } from './services';
import { initBindings } from './bindings/factory';
import { selectSerialProtocol } from './bindings/serial';
import app from '../app.json';
import { useLogging, useUnmountEffect } from './hooks';
import { LoadingScreen } from './pages/LoadingScreen/LoadingScreen';
import { getBleBinding } from './bindings/ble';
import { RootNavigator } from './pages/RootNavigator';
import { getUIBinding } from './bindings/ui';
import { logDeviceInfo } from './utils/deviceInfo';
import { useOnlineStatusMonitoringInit } from './hooks/network/useOnlineStatusMonitoring';
import { MainPage } from './pages/MainPage/MainPage';
import { NavigationBar } from '@zoontek/react-native-navigation-bar';
import { SecretsStatus } from './bindings/secret/types';
import { getMessageQueueBinding  } from './bindings/mq';
import { getAppVersion, isProdVariant } from './bindings/appInfo';
import { getUserSettingsBinding } from './bindings/user-settings';
import { getSystemVersion, getTotalMemory, isEmulator } from 'react-native-device-info';

LogBox.ignoreLogs(['new NativeEventEmitter()']);
let lastState = AppState.currentState;

interface AppProps {
    secretsStatus?: SecretsStatus;
}

const DeviceInfoLogger = ({ children }: PropsWithChildren<{}>): ReactElement => {
    const refLogged = useRef(false);
    let { width, height, scale, fontScale } = useWindowDimensions();

    width = Math.floor(width);
    height = Math.floor(height);
    scale = Math.round(scale * 10) / 10;
    fontScale = Math.round(fontScale * 10) / 10;

    useEffect(() => {
        if (refLogged.current) return;

        if (width !== undefined && height !== undefined) {
            logDeviceInfo({ width, height, scale, fontScale });
            refLogged.current = true;
        }
    }, [fontScale, height, scale, width]);

    return <>{children}</>;
};

export const App = ({ secretsStatus }: AppProps) => {
    const isDarkMode = useColorScheme() === 'dark';
    const service = useIncyclist({ secretsStatus });
    const ble = getBleBinding();
    const [initialized, setInitialized] = useState<boolean>(false);

    const { logError, logEvent } = useLogging('Incyclist');

    const { stopMonitoring } = useOnlineStatusMonitoringInit();
    const refStopMonitoring = useRef<() => void>(stopMonitoring);

    useEffect(() => {
        const sub = AppState.addEventListener('change', nextState => {
            // raw transition, logged unconditionally (unlike onAppPause/onAppResume below,
            // which only fire on a boundary crossing to/from 'active') — kept for diagnosing
            // page/session state changes that happen while the app is backgrounded
            logEvent({ message: 'AppState changed', from: lastState, to: nextState });

            if (lastState === 'active' && nextState !== 'active') {
                service.onAppPause()
            }

            if (lastState !== 'active' && nextState === 'active') {
                ble.initializeAuthorization();
                service.onAppResume();
            }

            lastState = nextState;
        });

        return () => sub.remove();
    }, [service, ble, logEvent]);

    useEffect(() => {
        if (Platform.OS !== 'android') return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            logEvent({ message: 'hardwareBackPress received' });
            // best-effort: this path can end in a hard process kill (see UIBinding.quit()),
            // which would otherwise silently drop onAppExit()'s own log lines along with
            // whatever else is still queued in the batch — flush after it resolves, right
            // before the potential kill, so this path is diagnosable if it fires again
            service.onAppExit()
                .then(() => flushLogs())
                .finally(() => {
                    getUIBinding().quit();
                });
            return false; // allow default exit
        });

        return () => sub.remove();
    }, [service, logEvent]);

    useEffect(() => {
        if (initialized) return;

        logEvent({ message: 'Initializing App' });

        const features: AppFeatures = {
            // serial: External Accessory (MFi) devices such as the Kettler Racer S - iOS only
            interfaces: Platform.OS === 'ios' ? ['wifi', 'ble', 'serial'] : ['wifi', 'ble'],
            ble: '*',
            wifi: '*',
        };

        const init = async () => {
            try {
                const bindings = await initBindings();
                service.setBindings(bindings as IncyclistBindings);

                getMessageQueueBinding().connect()

                const uiVersion = bindings.appInfo?.getUIVersion() ?? app.bundleVersion;
                await service.onAppLaunch('mobile', uiVersion, features);
                if (Platform.OS === 'ios')
                    selectSerialProtocol()

                // Ensure x-uuid is in API headers — initRestLogging may have run before
                // uuid was generated on first launch
                const uuid = getUserSettingsBinding().getValue('uuid', null);
                if (uuid && !ApiConfiguration.getInstance().getHeaders()['x-uuid']) {
                    ApiConfiguration.getInstance().addHeader('x-uuid', uuid);
                }
                
                logEvent({ message: 'Initializing App done', isProdVariant  });

                try {
                    const platform = Platform.OS
                    const emulator = await isEmulator()
                    const release = getSystemVersion()
                    const memBytes = await getTotalMemory()
                    const mem = Math.round(memBytes/1024/1024/1024) + ' GB'
        
                    logEvent( {message:'os info',platform,release,emulator, mem})
                    
                }
                catch {
                    // ignore
                }
                
                setInitialized(true);
            } catch (err: any) {
                logError(err, 'App.init');
            }
        };

        init();
    }, [initialized, logError, logEvent, service]);

    useUnmountEffect(() => {
        refStopMonitoring?.current();
    });

    if (!initialized) {
        
        return <LoadingScreen appVersion={getAppVersion()} bundleVersion={app.bundleVersion} statusMessage='connecting ...' />;
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaProvider>
                <StatusBar hidden={true} barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
                <NavigationBar hidden={true} />
                {initialized ? (
                    <DeviceInfoLogger>
                        <RootNavigator />
                    </DeviceInfoLogger>
                ) : (
                    <MainPage />
                )}
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});