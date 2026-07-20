package dev.jilatax.android

import android.app.Application
import android.graphics.Typeface
import android.net.Uri
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.fontface.FontFace
import com.lynx.tasm.loader.LynxFontFaceLoader
import com.lynx.tasm.utils.TypefaceUtils
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException

internal class JilataxFontFaceLoader(
    private val application: Application,
) : LynxFontFaceLoader.Loader() {
    private val httpClient = OkHttpClient()

    override fun onLoadFontFace(
        context: LynxContext,
        type: FontFace.TYPE,
        source: String,
    ): Typeface? {
        if (type != FontFace.TYPE.URL) {
            return super.onLoadFontFace(context, type, source)
        }
        if (source.startsWith("http://") || source.startsWith("https://")) {
            return loadRemote(context, source)
        }
        if (!source.startsWith(ANDROID_ASSET_PREFIX)) {
            return super.onLoadFontFace(context, type, source)
        }

        val assetPath = Uri.decode(source.removePrefix(ANDROID_ASSET_PREFIX))
        if (assetPath.isBlank() || assetPath.split('/').any { it == ".." }) {
            reportException(context, "Invalid Android font asset path: $source")
            return null
        }

        return try {
            Typeface.createFromAsset(application.assets, assetPath)
        } catch (error: RuntimeException) {
            reportException(
                context,
                "Unable to load Android font asset $assetPath: ${error.message}",
            )
            null
        }
    }

    private fun loadRemote(
        context: LynxContext,
        source: String,
    ): Typeface? {
        return try {
            val request = Request.Builder().url(source).get().build()
            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    reportException(
                        context,
                        "Unable to load remote font $source: HTTP ${response.code}",
                    )
                    return null
                }

                val bytes = response.body?.bytes()
                if (bytes == null || bytes.isEmpty()) {
                    reportException(
                        context,
                        "Unable to load remote font $source: empty response",
                    )
                    return null
                }

                TypefaceUtils.createFromBytes(application, bytes).also { typeface ->
                    if (typeface == null) {
                        reportException(context, "Unable to decode remote font: $source")
                    }
                }
            }
        } catch (error: IOException) {
            reportException(
                context,
                "Unable to load remote font $source: ${error.message}",
            )
            null
        } catch (error: IllegalArgumentException) {
            reportException(context, "Invalid remote font URL $source: ${error.message}")
            null
        }
    }

    private companion object {
        const val ANDROID_ASSET_PREFIX = "asset:///"
    }
}
