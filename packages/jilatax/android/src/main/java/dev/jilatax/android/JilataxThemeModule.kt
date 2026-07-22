package dev.jilatax.android

import com.lynx.jsbridge.LynxContextModule
import com.lynx.jsbridge.LynxMethod
import com.lynx.react.bridge.Callback
import com.lynx.tasm.behavior.LynxContext

class JilataxThemeModule(
    private val lynxContext: LynxContext,
) : LynxContextModule(lynxContext) {
    @LynxMethod
    fun setPreference(
        preference: String,
        callback: Callback?,
    ) {
        val result =
            JilataxTheme.setPreference(
                context = lynxContext.context,
                value = preference,
                activity = lynxContext.activity,
            )
        callback?.invoke(
            result.success,
            result.state.themePreference,
            result.state.appTheme,
        )
    }

    companion object {
        const val NAME = "JilataxTheme"
    }
}
