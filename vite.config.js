import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vueDevTools from 'vite-plugin-vue-devtools'

const cesiumSource = 'node_modules/cesium/Build/Cesium'
// This is the base url for static files that CesiumJS needs to load.
// Set to an empty string to place the files at the site's root path
const cesiumBaseUrl = 'cesiumStatic'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Define relative base path in cesium for loading assets
    // https://vitejs.dev/config/shared-options.html#define
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`)
  },
  plugins: [
    vue(),
    vueDevTools(),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl }
      ]
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://test.hub.dev.flyingeye.fr', // URL cible
        changeOrigin: true, // Modifie l'origine de la requête
        secure: false // Utilise true si SSL est correct, false si SSL auto-signé
        //rewrite: (path) => path.replace(/^\/api/, '/api') // Garde `/api` dans l'URL
      }
    }
  }
})
