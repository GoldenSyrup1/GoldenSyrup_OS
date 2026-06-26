// Centralised, typed access to the VITE_* runtime config.
// Anything here is bundled into the browser — keep it to non-secret base URLs.
export const env = {
  intelBase: (import.meta.env.VITE_INTEL_API_BASE ?? '').replace(/\/$/, ''),
  weportBase: (import.meta.env.VITE_WEPORT_API_BASE ?? '').replace(/\/$/, ''),
  stallInBase: (import.meta.env.VITE_STALLIN_API_BASE ?? '').replace(/\/$/, ''),
  connectorBase: (import.meta.env.VITE_CONNECTOR_API_BASE ?? '').replace(/\/$/, ''),
  connectorToken: import.meta.env.VITE_CONNECTOR_READ_TOKEN ?? '',
}

/** Public ETH spot price (no key required). */
export const ETH_PRICE_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
