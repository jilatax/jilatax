import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.jilatax.android"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
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
    implementation("com.tiktok.sparkling:sparkling:2.1.0-rc.33") {
        exclude(group = "org.lynxsdk.lynx", module = "lynx-service-devtool")
        exclude(group = "org.lynxsdk.lynx", module = "lynx-devtool")
        exclude(group = "org.lynxsdk.lynx", module = "debug-router")
        exclude(group = "org.lynxsdk.lynx", module = "base-devtool")
    }
    implementation("com.tiktok.sparkling:sparkling-method:2.1.0-rc.33")
    implementation("org.lynxsdk.lynx:xelement:3.7.0")
    implementation("org.lynxsdk.lynx:xelement-svg:3.7.0")
    implementation("org.lynxsdk.lynx:servalsvg:0.0.1-alpha.3")
    implementation("com.facebook.fresco:fresco:2.3.0")
    implementation("com.squareup.okhttp3:okhttp:4.9.0")
}
