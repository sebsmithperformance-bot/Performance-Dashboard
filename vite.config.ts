/// <reference types="vitest/config" />
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev-only middleware serving the generated synthetic dataset to the shell
 * (spec §7.3 local mode: synthetic data only). apply:'serve' means it cannot
 * exist in any production bundle or preview build.
 */
function devSyntheticData(): Plugin {
  const currentDir = () => path.resolve('seed/output/current')
  return {
    name: 'dev-synthetic-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-data/canonical.json', (_req, res) => {
        readFile(path.join(currentDir(), 'canonical.json'))
          .then((buf) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(buf)
          })
          .catch(() => {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'No generated dataset. Run: npm run seed:generate' }))
          })
      })
      // Generated sample files for the local Import page (§13: the demo season
      // enters through the real import pipeline)
      server.middlewares.use('/dev-data/fixtures.json', (_req, res) => {
        readdir(path.join(currentDir(), 'fixtures'))
          .then((names) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(names.filter((n) => n.endsWith('.csv')).sort()))
          })
          .catch(() => {
            res.statusCode = 404
            res.end('[]')
          })
      })
      server.middlewares.use('/dev-data/fixtures/', (req, res) => {
        const name = decodeURIComponent((req.url ?? '').replace(/^\//, ''))
        if (name.includes('..') || name.includes('/')) {
          res.statusCode = 400
          res.end('bad fixture name')
          return
        }
        readFile(path.join(currentDir(), 'fixtures', name))
          .then((buf) => {
            res.setHeader('Content-Type', 'text/csv')
            res.end(buf)
          })
          .catch(() => {
            res.statusCode = 404
            res.end('not found')
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devSyntheticData()],
  // PGlite ships its own WASM assets; pre-bundling breaks their resolution
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'db/**/*.test.ts',
      'seed/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
})
