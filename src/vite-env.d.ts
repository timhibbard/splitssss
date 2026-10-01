/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build timestamp, injected by vite.config.ts. Shown in the UI to catch stale builds. */
declare const __BUILD__: string

/** The boys' coach's number, scrambled, from the deploy secret. Empty on a local build. See sms.ts. */
declare const __BOYS_COACH__: string
