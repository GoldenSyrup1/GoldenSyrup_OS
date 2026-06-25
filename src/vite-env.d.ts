/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INTEL_API_BASE?: string
  readonly VITE_WEPORT_API_BASE?: string
  readonly VITE_CONNECTOR_API_BASE?: string
  readonly VITE_CONNECTOR_READ_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
