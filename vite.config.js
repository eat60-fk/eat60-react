import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

let buildOutputDirectory = ''

// VitePWA makes the site installable on phones (manifest + service worker).
// Put pwa-192.png and pwa-512.png (your logo) in the /public folder.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['avatars/*.png'],
      workbox: {
        navigateFallbackDenylist: [/^\/download-adminapp\/?$/, /^\/admin\/install\/?$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'eat60-public-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
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
    }),
    {
      name: 'eat60-admin-app-manifest',
      configResolved(config) {
        if (config.command === 'build') buildOutputDirectory = resolve(config.root, config.build.outDir)
      },
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (['/download-adminapp', '/admin/install'].includes(request.url?.split('?')[0])) {
            request.url = request.url.replace(/^\/(download-adminapp|admin\/install)/, '/admin-install.html')
          }
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (['/download-adminapp', '/admin/install'].includes(request.url?.split('?')[0])) {
            request.url = request.url.replace(/^\/(download-adminapp|admin\/install)/, '/admin-install.html')
          }
          next()
        })
      },
      transformIndexHtml: {
        order: 'post',
        handler(html, context) {
          if (!context.path.endsWith('admin-install.html')) return html
          const withoutManifest = html.replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, '')
          return withoutManifest.replace('</head>', '  <link rel="manifest" href="/eat60-admin.webmanifest">\n  </head>')
        }
      },
      async closeBundle() {
        if (!buildOutputDirectory) return
        const htmlPath = resolve(buildOutputDirectory, 'admin-install.html')
        const html = await readFile(htmlPath, 'utf8')
        const withoutManifest = html.replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, '')
        const adminManifestHtml = withoutManifest.replace('</head>', '  <link rel="manifest" href="/eat60-admin.webmanifest">\n  </head>')
        await writeFile(htmlPath, adminManifestHtml)
      }
    }
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'motion'
        }
      },
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        adminInstall: fileURLToPath(new URL('./admin-install.html', import.meta.url))
      }
    }
  }
})
