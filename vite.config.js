import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// VitePWA makes the site installable on phones (manifest + service worker).
// Put pwa-192.png and pwa-512.png (your logo) in the /public folder.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EAT60 by Foodverse Kitchen',
        short_name: 'EAT60',
        theme_color: '#141414',
        background_color: '#141414',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: 'pwa-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }
        ]
      }
    })
  ]
})
