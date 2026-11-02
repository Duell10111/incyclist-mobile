package com.incyclist.app
import android.content.res.Configuration
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory
import expo.modules.ReactNativeHostWrapper


import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import java.io.File
import org.wonday.orientation.OrientationActivityLifecycle




class MainApplication : Application(), ReactApplication {

    /**
     * Legacy/Standard Host (Still required for many tools)
     */
    override val reactNativeHost: ReactNativeHost =
        ReactNativeHostWrapper(this, object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {

                android.util.Log.d("Incyclist", "Legacy host")

                val packages = PackageList(this).packages.toMutableList()
                packages.add(ExitPackage()) // Add manual package here
                packages.add(FolderAccessPackage())
                packages.add(StreetViewPackage())
                packages.add(SatelliteViewPackage())
                packages.add(MapAvailabilityPackage())
                packages.add(AudioCuePackage())

                return packages
            }

            override fun getJSMainModuleName(): String = "index"
            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        })


    /**
     * Custom ReactHost implementation.
     * This is where your app handles dynamic bundle paths.
     */

    override val reactHost: ReactHost by lazy {
        // react-native-default-preference always writes through PreferenceManager's default
        // shared preferences file (<packageName>_preferences); the differently-named
        // "react-native-default-preference" file the library appears to imply is never used and
        // is always empty. Only this fallback path ever actually resolves a stored value.
        val prefs = android.preference.PreferenceManager.getDefaultSharedPreferences(this)

        // Native-version gate: SharedPreferences and filesDir both survive an APK upgrade, so a
        // bundle pointer written by a previous native version would otherwise keep loading
        // against a native contract it was never built against (the incident this fixes - see
        // FIXES_BACKLOG.md item #49). A mismatch - including the first boot ever, where
        // last_native_version is null - drops the pointer so the embedded bundle loads, and
        // clears the boot-confirmation state so a bundle that crashed against old native code
        // gets a fresh chance against the new one. Native performs no file I/O here: it only
        // drops the pointer, the orphaned directory is reclaimed by JS
        // (UpdateService.cleanupOldBundles).
        val lastNativeVersion = prefs.getString("last_native_version", null)
        if (lastNativeVersion != BuildConfig.VERSION_NAME) {
            prefs.edit()
                .remove("active_bundle_path")
                .remove("active_bundle_version")
                .remove("failed_bundle_version")
                .remove("bundle_boot_failures")
                .putString("last_native_version", BuildConfig.VERSION_NAME)
                .apply()
        }

        val bundlePathRoot = prefs.getString("active_bundle_path", null)

        android.util.Log.d("Incyclist", "Native Shell looking for bundle at: $bundlePathRoot")

        var bundleFile = bundlePathRoot?.let { path ->
            val file = File(path, "index.android.bundle")
            android.util.Log.d("Incyclist", "Bundle file exists? ${file.exists()}")
            if (file.exists()) file.absolutePath else null
        }

        // Boot confirmation: an OTA bundle starts unconfirmed on every boot that uses it.
        // Loader.tsx clears the counter once the app is demonstrably alive
        // (setIsLoading(false)); two consecutive unconfirmed boots revert to the embedded bundle
        // and blacklist the version so fetchBundleInfo won't re-download the same broken bundle.
        // The counter is stored and read as a String on purpose: react-native-default-preference
        // always writes via putString, and a Kotlin getInt() on that key throws
        // ClassCastException.
        if (bundleFile != null) {
            val bootFailures = prefs.getString("bundle_boot_failures", "0")?.toIntOrNull() ?: 0
            if (bootFailures >= 2) {
                val failedBundleVersion = prefs.getString("active_bundle_version", null)
                prefs.edit()
                    .remove("active_bundle_path")
                    .putString("failed_bundle_version", failedBundleVersion)
                    .remove("active_bundle_version")
                    .putString("bundle_boot_failures", "0")
                    .apply()
                bundleFile = null
            } else {
                prefs.edit().putString("bundle_boot_failures", (bootFailures + 1).toString()).apply()
            }
        }

        // IMPORTANT: Manually merge ExitPackage into the host's package list
        val packages = PackageList(this).packages.toMutableList()
        packages.add(ExitPackage())
        packages.add(FolderAccessPackage())
        packages.add(StreetViewPackage())
        packages.add(SatelliteViewPackage())
        packages.add(MapAvailabilityPackage())
        packages.add(AudioCuePackage())

        ExpoReactHostFactory.getDefaultReactHost(
            context = applicationContext,
            packageList = packages,
            jsMainModulePath = "index", // This must be a non-null String
            jsBundleFilePath = bundleFile // This is allowed to be String?
        )


    }    

    override fun onCreate() {
        super.onCreate()
        loadReactNative(this)

        // react-native-orientation-locker ships an ActivityLifecycleCallbacks implementation
        // (OrientationActivityLifecycle) but never attaches it to the Application. Without it,
        // the module's OrientationEventListener is enabled once at construction and never
        // disabled, so the accelerometer keeps sampling at SENSOR_DELAY_UI (15Hz) while the app
        // is in the background. Attaching it lets the library stop the sensor once no activity
        // is running. Orientation locking itself does not depend on the sensor.
        registerActivityLifecycleCallbacks(OrientationActivityLifecycle.getInstance())

        // super.onCreate()        
        // SoLoader.init(this, false)
        // if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
        //     load()
        // }

      ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}