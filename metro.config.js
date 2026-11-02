// metro.config.js
const path = require('path');
const fs = require('fs'); 
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');

// 1. Define the path to your library source
const servicesPath = path.resolve(__dirname, '../services/lib/esm');
const devicesPath = path.resolve(__dirname, '../devices/lib/esm');

const defaultConfig = getDefaultConfig(__dirname);
const {
  resolver: { sourceExts, assetExts }
} = defaultConfig;

// 2. Check if folder exists AND we are in dev mode
const isDev = process.env.APP_VARIANT === 'debug' || process.env.APP_VARIANT === 'dev'
const canUseLocalServicesLib = isDev && fs.existsSync(servicesPath);
const canUseLocalDevicesLib  = isDev && fs.existsSync(devicesPath);


console.log('# ISDEV', isDev)
console.log('# SERVICES', canUseLocalServicesLib ?  servicesPath : false)
console.log('# DEVICES', canUseLocalDevicesLib ? devicesPath : false)

const watchFolders = []
const blockList = [
    // /node_modules\/uuid\/.*/
] 

const servicesRoot = path.resolve(__dirname, '../services');
const devicesRoot = path.resolve(__dirname, '../devices');


if (canUseLocalServicesLib)  {
    blockList.push(/node_modules\/incyclist-services\/.*/)
    watchFolders.push(servicesPath)
}
else {
    blockList.push( new RegExp(`${servicesRoot.replace(/[/\\\\]/g, '[/\\\\]')}/.*`), )

}
if (canUseLocalDevicesLib)  {
    blockList.push(/node_modules\/incyclist-devices\/.*/)
    watchFolders.push(devicesPath)
}

let settingsPath;

if (isDev) {
    settingsPath=path.resolve(__dirname, `config/${process.env.APP_VARIANT }/settings.json`)
    if (!fs.existsSync(settingsPath)) {
      settingsPath = path.resolve(__dirname, 'polyfill/empty-config.ts');  
    }
}
else {
    settingsPath = path.resolve(__dirname, 'polyfill/settings.ts');
}


const configPath = path.resolve(__dirname, 'config/config.json');
const configAlias = fs.existsSync(configPath)
    ? configPath
    : path.resolve(__dirname, 'polyfill/empty-config.ts');

const assetsPath = path.resolve(__dirname, 'src/assets');
/**
 * Metro configuration
 * 
 
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
    watchFolders,
    transformer: {
        babelTransformerPath: require.resolve('react-native-svg-transformer'),
    },
    resolver: {
        // The serial interface (iOS: External Accessory devices) needs the real @serialport packages, which
        // need real streams - while 'stream' stays mocked for everything else (see extraNodeModules):
        // - @serialport/* is always resolved from this app (a local incyclist-devices lib is outside the
        //   watched folders and would otherwise fall back to the mock)
        // - 'stream' required by @serialport/* resolves to stream-browserify
        resolveRequest: (context, moduleName, platform) => {
            if (moduleName.startsWith('@serialport/'))
                return context.resolveRequest({ ...context, originModulePath: path.resolve(__dirname, 'index.js') }, moduleName, platform)
            if (moduleName === 'stream' && /[/\\]@serialport[/\\]/.test(context.originModulePath))
                return context.resolveRequest(context, 'stream-browserify', platform)
            return context.resolveRequest(context, moduleName, platform)
        },

        blockList,
        assetExts: assetExts.filter((ext) => ext !== 'svg'),
        sourceExts: [...sourceExts, 'svg'],        
        extraNodeModules: new Proxy({
            'incyclist-ant-plus': path.resolve(__dirname, 'polyfill/node-mocks.js'),
            'events': path.resolve(__dirname, 'node_modules/events'),
            'node:events':path.resolve(__dirname, 'node_modules/events'),
            'serialport': path.resolve(__dirname, 'polyfill/node-mocks.js'), // FIXED: was empty-module
            'fs': path.resolve(__dirname, 'polyfill/node-mocks.js'),
            'stream': path.resolve(__dirname, 'polyfill/node-mocks.js'),     // FIXED: was empty-module
            '@settings' : settingsPath,
            '@assets':assetsPath,
            '@config': configAlias,

            // Logic-only mocks can stay as empty-module
            'path': require.resolve('metro-runtime/src/modules/empty-module.js'),
            'crypto': require.resolve('metro-runtime/src/modules/empty-module.js'),
            'net': require.resolve('metro-runtime/src/modules/empty-module.js'),
            'os': require.resolve('metro-runtime/src/modules/empty-module.js'),
            'timers': require.resolve('metro-runtime/src/modules/empty-module.js'),
            
            'process': require.resolve('process/browser'),
            'buffer': require.resolve('buffer'),  
            ...(canUseLocalServicesLib ? { 'incyclist-services': servicesPath } : {}),            
            ...(canUseLocalDevicesLib ? { 'incyclist-devices': devicesPath } : {}),            
        }, {
        get: (target,name) =>  {
            return name in target ? target[name] : path.join(process.cwd(), `node_modules/${name}`)
            }            
        })
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);