import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const BUILD = `${(process.env.GITHUB_SHA || 'dev').slice(0, 7)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(BUILD) },
  // Relative asset paths for the single-file / hash-routed build.
  base: process.env.VITE_HASH_ROUTER === '1' ? './' : '/',
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]
});