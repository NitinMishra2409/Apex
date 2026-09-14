import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { transcribeWav, readRawBody, TranscribeError } from './api/_nvidia.js'

// Serves POST /api/transcribe during `npm run dev`, mirroring the Vercel
// function in api/transcribe.js. This runs in Node inside the dev server, so
// NVIDIA_API_KEY is never exposed to the browser.
function devApi(env) {
  return {
    name: 'apexlog-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/transcribe', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Method not allowed.' }))
        }
        res.setHeader('Content-Type', 'application/json')
        try {
          const audio = await readRawBody(req)
          const language = new URL(req.url, 'http://localhost').searchParams.get('language') || 'en-US'
          const text = await transcribeWav(
            audio, language, env.NVIDIA_API_KEY, env.NVIDIA_ASR_FUNCTION_ID || undefined,
          )
          res.statusCode = 200
          res.end(JSON.stringify({ text }))
        } catch (err) {
          const isKnown = err instanceof TranscribeError
          res.statusCode = isKnown ? err.status : 500
          if (!isKnown) server.config.logger.error(`[transcribe] ${err.stack || err.message}`)
          res.end(JSON.stringify({
            error: isKnown ? err.message : 'Transcription failed.',
            code: isKnown ? err.code : 'UNKNOWN',
          }))
        }
      })
    },
  }
}

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
