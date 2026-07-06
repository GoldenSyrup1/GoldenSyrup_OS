/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_INTEL_API_BASE?: string
  readonly VITE_WEPORT_API_BASE?: string
  readonly VITE_CONNECTOR_API_BASE?: string
  readonly VITE_CONNECTOR_READ_TOKEN?: string
  readonly VITE_STALLIN_API_BASE?: string
  /** Base URL of the local orchestrator that runs Claude Code on-demand. */
  readonly VITE_OS_ORCHESTRATOR_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
