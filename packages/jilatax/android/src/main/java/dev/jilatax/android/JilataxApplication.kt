package dev.jilatax.android

import android.app.Application
import android.content.res.Configuration

open class JilataxApplication : Application() {
    private var nightMode = Configuration.UI_MODE_NIGHT_UNDEFINED

    override fun onCreate() {
        super.onCreate()
        nightMode = resources.configuration.nightMode()
        JilataxRuntime.initialize(this)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val updatedNightMode = newConfig.nightMode()
        if (updatedNightMode == nightMode) return

        nightMode = updatedNightMode
        JilataxTheme.onSystemThemeChanged(this)
    }
}

private fun Configuration.nightMode(): Int = uiMode and Configuration.UI_MODE_NIGHT_MASK
