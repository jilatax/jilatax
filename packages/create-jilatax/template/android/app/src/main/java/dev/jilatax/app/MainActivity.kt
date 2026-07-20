package dev.jilatax.app

import android.content.res.Configuration
import android.os.Bundle
import dev.jilatax.android.JilataxActivity
import dev.jilatax.android.JilataxBundleSource

class MainActivity : JilataxActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        currentBundleSource = intent?.getStringExtra(JilataxBundleSource.INTENT_EXTRA)
        super.onCreate(savedInstanceState)
    }

    override fun initialDataJson(): String {
        val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        val appTheme = if (nightMode == Configuration.UI_MODE_NIGHT_YES) "dark" else "light"

        return """{"appTheme":"$appTheme"}"""
    }

    companion object {
        @Volatile
        internal var currentBundleSource: String? = null
            private set
    }
}
