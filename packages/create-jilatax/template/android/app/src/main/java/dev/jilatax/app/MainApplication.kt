package dev.jilatax.app

import android.content.ComponentName
import android.content.Intent
import android.content.res.Configuration
import dev.jilatax.android.JilataxApplication
import dev.jilatax.android.JilataxBundleSource

class MainApplication : JilataxApplication() {
    private var nightMode = Configuration.UI_MODE_NIGHT_UNDEFINED

    override fun onCreate() {
        super.onCreate()
        nightMode = resources.configuration.nightMode()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)

        val updatedNightMode = newConfig.nightMode()
        if (updatedNightMode == nightMode) return

        nightMode = updatedNightMode
        val launcher = ComponentName(packageName, JILATAX_LAUNCHER_ACTIVITY)
        val restartIntent = Intent.makeRestartActivityTask(launcher)
        MainActivity.currentBundleSource?.let { bundleSource ->
            restartIntent.putExtra(JilataxBundleSource.INTENT_EXTRA, bundleSource)
        }
        startActivity(restartIntent)
    }
}

private const val JILATAX_LAUNCHER_ACTIVITY = "dev.jilatax.android.JilataxActivity"

private fun Configuration.nightMode(): Int = uiMode and Configuration.UI_MODE_NIGHT_MASK
