package dev.jilatax.android

import android.app.Application

open class JilataxApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        JilataxRuntime.initialize(this)
    }
}
