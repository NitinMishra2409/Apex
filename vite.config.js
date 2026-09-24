import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { devApi } from './scripts/dev-api.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' prefix loads every var, including server-only ones like NVIDIA_API_KEY.
  // These stay in the Node process; only VITE_* reach the client bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), devApi(env)],
    build: {
      rollupOptions: {
        output: {
          // Split vendors so a page only downloads what it needs. Recharts is
          // ~half the bundle but is used by two routes, both lazy-loaded, so
          // keeping it separate keeps it off the critical path.
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('react-router')) return 'router'
            if (id.includes('lucide-react')) return 'icons'
            return 'vendor'
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  }
})
