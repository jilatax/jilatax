package dev.jilatax.android

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
import com.tiktok.sparkling.hybridkit.KitViewManager
import com.tiktok.sparkling.hybridkit.base.IKitView
import org.json.JSONException
import org.json.JSONObject
import java.util.Collections
import java.util.Locale
import java.util.WeakHashMap

internal data class JilataxThemeState(
    val themePreference: String,
    val appTheme: String,
)

internal data class JilataxThemeUpdate(
    val success: Boolean,
    val state: JilataxThemeState,
)

internal object JilataxTheme {
    private const val PREFERENCES_NAME = "dev.jilatax.theme"
    private const val PREFERENCE_KEY = "preference"
    private const val USER_INTERFACE_STYLE_METADATA = "dev.jilatax.userInterfaceStyle"
    private const val THEME_PREFERENCE_DATA_KEY = "themePreference"
    private const val APP_THEME_DATA_KEY = "appTheme"

    private val mainHandler = Handler(Looper.getMainLooper())
    private val activities =
        Collections.newSetFromMap(WeakHashMap<Activity, Boolean>())

    @Volatile
    private var initialized = false

    @Volatile
    private var applicationContext: Context? = null

    fun initialize(application: Application) {
        if (initialized) return

        synchronized(this) {
            if (initialized) return
            applicationContext = application.applicationContext
            application.registerActivityLifecycleCallbacks(ThemeActivityCallbacks)
            KitViewManager.addKitViewCreatedListener(ThemeKitViewCreatedListener)
            initialized = true
        }
    }

    fun enrichInitialData(
        context: Context,
        initialDataJson: String,
    ): String {
        val initialData =
            try {
                JSONObject(initialDataJson)
            } catch (error: JSONException) {
                throw IllegalArgumentException(
                    "Jilatax initial data must be a JSON object.",
                    error,
                )
            }
        val state = state(context)
        initialData.put(THEME_PREFERENCE_DATA_KEY, state.themePreference)
        initialData.put(APP_THEME_DATA_KEY, state.appTheme)
        return initialData.toString()
    }

    fun setPreference(
        context: Context,
        value: String,
        activity: Activity?,
    ): JilataxThemeUpdate {
        val preference = ThemePreference.fromValue(value)
        if (preference == null) {
            return JilataxThemeUpdate(success = false, state = state(context))
        }

        val saved =
            preferences(context)
                .edit()
                .putString(PREFERENCE_KEY, preference.value)
                .commit()
        val state = state(context)
        if (saved) {
            refreshUi(state, activity, publish = true)
        }
        return JilataxThemeUpdate(success = saved, state = state)
    }

    fun onSystemThemeChanged(context: Context) {
        val state = state(context)
        refreshUi(
            state = state,
            activity = null,
            publish = true,
            defer = true,
        )
    }

    private fun state(context: Context): JilataxThemeState {
        val preference = readPreference(context)
        val appTheme =
            when (preference) {
                ThemePreference.LIGHT -> AppTheme.LIGHT
                ThemePreference.DARK -> AppTheme.DARK
                ThemePreference.SYSTEM -> systemTheme(context.resources.configuration)
            }
        return JilataxThemeState(
            themePreference = preference.value,
            appTheme = appTheme.value,
        )
    }

    private fun readPreference(context: Context): ThemePreference {
        val savedValue = preferences(context).getString(PREFERENCE_KEY, null)
        return ThemePreference.fromValue(savedValue) ?: defaultPreference(context)
    }

    private fun preferences(context: Context) =
        context.applicationContext.getSharedPreferences(
            PREFERENCES_NAME,
            Context.MODE_PRIVATE,
        )

    @Suppress("DEPRECATION")
    private fun defaultPreference(context: Context): ThemePreference {
        val packageManager = context.packageManager
        val applicationInfo =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                packageManager.getApplicationInfo(
                    context.packageName,
                    PackageManager.ApplicationInfoFlags.of(
                        PackageManager.GET_META_DATA.toLong(),
                    ),
                )
            } else {
                packageManager.getApplicationInfo(
                    context.packageName,
                    PackageManager.GET_META_DATA,
                )
            }
        val configuredStyle =
            applicationInfo.metaData
                ?.getString(USER_INTERFACE_STYLE_METADATA)
                ?.lowercase(Locale.ROOT)
        return when (configuredStyle) {
            ThemePreference.LIGHT.value -> ThemePreference.LIGHT
            ThemePreference.DARK.value -> ThemePreference.DARK
            else -> ThemePreference.SYSTEM
        }
    }

    private fun systemTheme(configuration: Configuration): AppTheme {
        val nightMode = configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        return if (nightMode == Configuration.UI_MODE_NIGHT_YES) {
            AppTheme.DARK
        } else {
            AppTheme.LIGHT
        }
    }

    private fun refreshUi(
        state: JilataxThemeState,
        activity: Activity?,
        publish: Boolean,
        defer: Boolean = false,
    ) {
        val action = {
            activity?.let(activities::add)
            activities.toList().forEach { currentActivity ->
                applyToActivity(currentActivity, state.appTheme)
            }
            if (publish) publish(state)
        }
        if (defer) {
            mainHandler.post(action)
        } else {
            runOnMainThread(action)
        }
    }

    private fun publish(state: JilataxThemeState) {
        val data = themeData(state)
        KitViewManager.getKitViews().values.toList().forEach { kitView ->
            kitView.updateData(data)
        }
    }

    private fun themeData(state: JilataxThemeState): Map<String, Any> =
        mapOf(
            THEME_PREFERENCE_DATA_KEY to state.themePreference,
            APP_THEME_DATA_KEY to state.appTheme,
        )

    @Suppress("DEPRECATION")
    private fun applyToActivity(
        activity: Activity,
        appTheme: String,
    ) {
        val isLightTheme = appTheme == AppTheme.LIGHT.value
        val backgroundColor = if (isLightTheme) Color.WHITE else Color.BLACK
        val navigationBarColor =
            if (isLightTheme && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                Color.BLACK
            } else {
                backgroundColor
            }
        val window = activity.window
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
        window.decorView.setBackgroundColor(backgroundColor)
        window.statusBarColor = backgroundColor
        window.navigationBarColor = navigationBarColor

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.navigationBarDividerColor = navigationBarColor
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.decorView.isForceDarkAllowed = false
            window.isStatusBarContrastEnforced = false
            window.isNavigationBarContrastEnforced = false
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val lightBarAppearance =
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            val appearance = if (isLightTheme) lightBarAppearance else 0
            window.insetsController?.setSystemBarsAppearance(
                appearance,
                lightBarAppearance,
            )
            return
        }

        var visibility = window.decorView.systemUiVisibility
        visibility = visibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            visibility = visibility and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
        }
        if (isLightTheme) {
            visibility = visibility or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                visibility = visibility or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            }
        }
        window.decorView.systemUiVisibility = visibility
    }

    private fun runOnMainThread(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            action()
        } else {
            mainHandler.post(action)
        }
    }

    private object ThemeActivityCallbacks : Application.ActivityLifecycleCallbacks {
        override fun onActivityCreated(
            activity: Activity,
            savedInstanceState: Bundle?,
        ) {
            activities.add(activity)
            applyToActivity(activity, state(activity).appTheme)
        }

        override fun onActivityResumed(activity: Activity) {
            refreshUi(
                state = state(activity),
                activity = activity,
                publish = true,
                defer = true,
            )
        }

        override fun onActivityDestroyed(activity: Activity) {
            activities.remove(activity)
        }

        override fun onActivityStarted(activity: Activity) = Unit

        override fun onActivityPaused(activity: Activity) = Unit

        override fun onActivityStopped(activity: Activity) = Unit

        override fun onActivitySaveInstanceState(
            activity: Activity,
            outState: Bundle,
        ) = Unit
    }

    private object ThemeKitViewCreatedListener :
        KitViewManager.KitViewCreatedListener {
        override fun onKitViewCreated(kitView: IKitView) {
            val context = applicationContext ?: return
            val data = themeData(state(context))
            mainHandler.post {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    kitView.realView()?.isForceDarkAllowed = false
                }
                activities.toList().forEach { activity ->
                    applyToActivity(activity, data.getValue(APP_THEME_DATA_KEY).toString())
                }
                kitView.updateData(data)
            }
        }
    }

    private enum class ThemePreference(
        val value: String,
    ) {
        LIGHT("light"),
        DARK("dark"),
        SYSTEM("system"),
        ;

        companion object {
            fun fromValue(value: String?): ThemePreference? =
                entries.firstOrNull { preference -> preference.value == value }
        }
    }

    private enum class AppTheme(
        val value: String,
    ) {
        LIGHT("light"),
        DARK("dark"),
    }
}
