import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val jilataxConfigFile = rootProject.file("jilatax.properties")
check(jilataxConfigFile.isFile) {
    "Missing android/jilatax.properties. Run a Jilatax Android command from the project root."
}
val jilataxConfig = Properties().apply {
    jilataxConfigFile.reader(Charsets.UTF_8).use(::load)
}

fun requiredConfig(key: String): String =
    checkNotNull(jilataxConfig.getProperty(key)?.takeIf { it.isNotBlank() }) {
        "Missing Jilatax Android property: $key"
    }

val appName = requiredConfig("jilatax.name")
val appPackage = requiredConfig("jilatax.android.package")
val appVersion = requiredConfig("jilatax.version")
val appVersionCode = requiredConfig("jilatax.android.versionCode").toInt()
val appScheme = requiredConfig("jilatax.scheme")
val userInterfaceStyle =
    when (val style = requiredConfig("jilatax.userInterfaceStyle")) {
        "automatic", "light", "dark" -> style
        else -> error("Unsupported Jilatax user interface style: $style")
    }
val predictiveBack = requiredConfig(
    "jilatax.android.predictiveBackGestureEnabled",
).toBooleanStrict()
val screenOrientation =
    when (requiredConfig("jilatax.orientation")) {
        "portrait" -> "portrait"
        "landscape" -> "landscape"
        else -> "unspecified"
    }
val splashBackground = requiredConfig("jilatax.splash.backgroundColor")

val signingFile = rootProject.file("keystore.properties")
val signingProperties = Properties()
val signingKeys = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val signingConfigured = signingFile.isFile
if (signingConfigured) {
    signingFile.reader(Charsets.UTF_8).use(signingProperties::load)
    check(signingKeys.all { !signingProperties.getProperty(it).isNullOrBlank() }) {
        "android/keystore.properties exists but is incomplete."
    }
}

android {
    namespace = appPackage
    compileSdk = 35

    defaultConfig {
        applicationId = appPackage
        minSdk = 24
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersion
        manifestPlaceholders["jilataxOrientation"] = screenOrientation
        manifestPlaceholders["jilataxPredictiveBack"] = predictiveBack.toString()
        manifestPlaceholders["jilataxScheme"] = appScheme
        manifestPlaceholders["jilataxUserInterfaceStyle"] = userInterfaceStyle
        resValue("string", "jilatax_app_name", appName)
        resValue("color", "jilatax_splash_background", splashBackground)
    }

    sourceSets {
        getByName("main").assets.srcDir(file("../../.jilatax/android-assets"))
        getByName("main").res.srcDir(file("../../.jilatax/android-res"))
    }

    signingConfigs {
        if (signingConfigured) {
            create("release") {
                storeFile = rootProject.file(signingProperties.getProperty("storeFile"))
                storePassword = signingProperties.getProperty("storePassword")
                keyAlias = signingProperties.getProperty("keyAlias")
                keyPassword = signingProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            isDebuggable = true
        }
        release {
            isMinifyEnabled = false
            if (signingConfigured) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_11)
    }
}

dependencies {
    implementation(project(":jilatax"))
}
