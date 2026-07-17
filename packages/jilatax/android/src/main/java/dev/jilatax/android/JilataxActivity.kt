package dev.jilatax.android

import android.app.Activity
import android.os.Bundle

open class JilataxActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        JilataxRuntime.launch(this, initialDataJson())
    }

    protected open fun initialDataJson(): String = "{\"initial_data\":{}}"
}
