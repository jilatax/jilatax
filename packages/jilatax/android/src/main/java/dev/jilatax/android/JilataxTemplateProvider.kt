package dev.jilatax.android

import android.content.Context
import com.lynx.tasm.provider.AbsTemplateProvider
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

class JilataxTemplateProvider(
    context: Context,
) : AbsTemplateProvider() {
    private val applicationContext = context.applicationContext
    private val httpClient = OkHttpClient()

    override fun loadTemplate(
        uri: String,
        callback: Callback,
    ) {
        Thread {
            try {
                if (uri.startsWith("http://") || uri.startsWith("https://")) {
                    loadRemote(uri, callback)
                } else {
                    applicationContext.assets.open(uri).use { stream ->
                        callback.onSuccess(stream.readBytes())
                    }
                }
            } catch (error: IOException) {
                callback.onFailed(error.message ?: "Unable to load Lynx bundle")
            }
        }.start()
    }

    private fun loadRemote(
        uri: String,
        callback: Callback,
    ) {
        val request = Request.Builder().url(uri).get().build()
        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                callback.onFailed("HTTP ${response.code}")
                return
            }
            val body = response.body?.bytes()
            if (body == null || body.isEmpty()) {
                callback.onFailed("Empty Lynx bundle response")
                return
            }
            callback.onSuccess(body)
        }
    }
}
