// Centralised, typed access to the VITE_* runtime config.
// Anything here is bundled into the browser — keep it to non-secret base URLs.
export const env = {
  intelBase: (import.meta.env.VITE_INTEL_API_BASE ?? '').replace(/\/$/, ''),
  weportBase: (import.meta.env.VITE_WEPORT_API_BASE ?? '').replace(/\/$/, ''),
  stallInBase: (import.meta.env.VITE_STALLIN_API_BASE ?? '').replace(/\/$/, ''),
  connectorBase: (import.meta.env.VITE_CONNECTOR_API_BASE ?? '').replace(/\/$/, ''),
  connectorToken: import.meta.env.VITE_CONNECTOR_READ_TOKEN ?? '',
  /** Local orchestrator that runs Claude Code on-demand; empty ⇒ stub runner. */
  orchestratorBase: (import.meta.env.VITE_OS_ORCHESTRATOR_BASE ?? '').replace(/\/$/, ''),
  /**
   * URL of the Cowork bridge file. Claude for Desktop's Cowork is local-only with
   * no API, so it writes a JSON snapshot into a connected folder; point this at it.
   * Defaults to `/cowork-state.json` (served from `public/`), which works in dev
   * and as a committed last-known snapshot on the static deploy.
   */
  coworkStateUrl: import.meta.env.VITE_COWORK_STATE_URL ?? '/cowork-state.json',
}

/** Public ETH spot price (no key required). */
export const ETH_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
