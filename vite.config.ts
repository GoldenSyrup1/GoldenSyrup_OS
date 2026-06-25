import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: false,
  },
  // Railway serves the built site via `vite preview`; bind to $PORT and trust
  // the Railway-assigned domain. allowedHosts:true is acceptable here — this is
  // a single-user dashboard with no host-header-sensitive logic.
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
