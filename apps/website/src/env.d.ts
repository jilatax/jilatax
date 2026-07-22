/// <reference types="astro/client" />

// Type your environment variables here for autocomplete + safety on
// `import.meta.env`. Astro exposes `PUBLIC_`-prefixed vars to the client;
// everything else stays server-only.
interface ImportMetaEnv {
  readonly UPSTASH_REDIS_REST_URL?: string;
  readonly UPSTASH_REDIS_REST_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
