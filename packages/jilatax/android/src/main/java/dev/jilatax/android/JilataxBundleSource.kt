package dev.jilatax.android

import android.net.Uri
import java.net.URI

sealed interface JilataxBundleSource {
    val value: String

    data class Asset(
        override val value: String,
    ) : JilataxBundleSource

    data class Remote(
        override val value: String,
    ) : JilataxBundleSource

    fun toNavigationScheme(): String {
        val encoded = Uri.encode(value)
        return when (this) {
            is Asset ->
                "hybrid://lynxview_page?bundle=$encoded&hide_nav_bar=1&screen_orientation=portrait"
            is Remote ->
                "hybrid://lynxview_page?url=$encoded&hide_nav_bar=1&screen_orientation=portrait"
        }
    }

    companion object {
        const val DEFAULT_BUNDLE = "main.lynx.bundle"
        const val INTENT_EXTRA = "dev.jilatax.bundleSource"

        fun resolve(
            explicitSource: String?,
            debuggable: Boolean,
        ): JilataxBundleSource {
            if (!debuggable) return Asset(DEFAULT_BUNDLE)

            val candidate = explicitSource?.trim().orEmpty()
            if (candidate.isEmpty()) return Asset(DEFAULT_BUNDLE)
            if (isValidRemoteUrl(candidate)) return Remote(candidate)
            if (isValidAssetPath(candidate)) return Asset(candidate)
            return Asset(DEFAULT_BUNDLE)
        }

        private fun isValidRemoteUrl(value: String): Boolean =
            runCatching {
                val uri = URI(value)
                (uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrBlank()
            }.getOrDefault(false)

        private fun isValidAssetPath(value: String): Boolean {
            if (value.startsWith('/') || value.contains("..")) return false
            return value.matches(Regex("[A-Za-z0-9][A-Za-z0-9._/-]*"))
        }
    }
}
