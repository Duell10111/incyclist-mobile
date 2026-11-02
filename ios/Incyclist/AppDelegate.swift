import UIKit
internal import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
    var window: UIWindow?
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    override func application(
        _ application: UIApplication, 
        supportedInterfaceOrientationsFor window: UIWindow? ) -> UIInterfaceOrientationMask {
      return .landscape
    }
	
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let delegate = ReactNativeDelegate()
        let factory = ExpoReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()

        reactNativeDelegate = delegate
        reactNativeFactory = factory

        window = UIWindow(frame: UIScreen.main.bounds)

        factory.startReactNative(
            withModuleName: "Incyclist",
            in: window,
            launchOptions: launchOptions
        )

        // Replace the root view controller with our full-screen subclass
        // that declaratively hides status bar and home indicator
        // if let rootView = window?.rootViewController?.view {
        //    let fullScreenVC = FullScreenViewController()
        //    fullScreenVC.view = rootView
        //    window?.rootViewController = fullScreenVC
        //}        

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    override func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void) {
        RNBackgroundDownloader.setCompletionHandlerWithIdentifier(identifier, completionHandler: completionHandler)
    }    
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
    // 0.83.1 uses bundleURL() as the primary source for the factory
    override func bundleURL() -> URL? {
        let defaults = UserDefaults.standard
        
        // 1. Check for the dynamic bundle path in UserDefaults
        if let bundlePath = defaults.string(forKey: "active_bundle_path") {
            let bundleURL = URL(fileURLWithPath: bundlePath).appendingPathComponent("main.jsbundle")
            
            if FileManager.default.fileExists(atPath: bundleURL.path) {
                return bundleURL
            }
        }

        // 2. Fallback to default behavior (Metro in Debug, main.jsbundle in Release)
        #if DEBUG
            return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
        #else
            return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
        #endif
      
    }

    // Explicitly point sourceURL to our bundleURL logic for backward compatibility
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        // bridge.bundleURL is needed to return the correct URL for expo-dev-client
        return bridge.bundleURL ?? bundleURL()
    }
}
