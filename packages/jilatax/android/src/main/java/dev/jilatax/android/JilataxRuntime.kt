package dev.jilatax.android

import android.app.Activity
import android.app.Application
import android.content.pm.ApplicationInfo
import com.facebook.drawee.backends.pipeline.Fresco
import com.lynx.tasm.loader.LynxFontFaceLoader
import com.tiktok.sparkling.Sparkling
import com.tiktok.sparkling.SparklingContext
import com.tiktok.sparkling.hybridkit.HybridKit
import com.tiktok.sparkling.hybridkit.config.BaseInfoConfig
import com.tiktok.sparkling.hybridkit.config.SparklingHybridConfig
import com.tiktok.sparkling.hybridkit.config.SparklingLynxConfig

object JilataxRuntime {
    @Volatile
    private var initialized = false

    fun initialize(application: Application) {
        if (initialized) return

        synchronized(this) {
            if (initialized) return
            if (!Fresco.hasBeenInitialized()) {
                Fresco.initialize(application)
            }

            LynxFontFaceLoader.setLoader(JilataxFontFaceLoader(application))
            HybridKit.init(application)
            val lynxConfig =
                SparklingLynxConfig.build(application) {
                    setTemplateProvider(JilataxTemplateProvider(application))
                }
            val hybridConfig =
                SparklingHybridConfig.build(
                    BaseInfoConfig(isDebug = application.isDebuggable()),
                ) {
                    setLynxConfig(lynxConfig)
                }
            HybridKit.setHybridConfig(hybridConfig, application)
            HybridKit.initLynxKit()
            initialized = true
        }
    }

    fun launch(
        activity: Activity,
        initialDataJson: String = "{\"initial_data\":{}}",
    ): Boolean {
        initialize(activity.application)
        val bundleSource =
            JilataxBundleSource.resolve(
                explicitSource = activity.intent?.getStringExtra(JilataxBundleSource.INTENT_EXTRA),
                debuggable = activity.application.isDebuggable(),
            )
        val context =
            SparklingContext().apply {
                scheme = bundleSource.toNavigationScheme()
                withInitData(initialDataJson)
            }
        val launched = Sparkling.build(activity, context).navigate()
        if (launched) activity.finish()
        return launched
    }

    private fun Application.isDebuggable(): Boolean =
        applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
}
