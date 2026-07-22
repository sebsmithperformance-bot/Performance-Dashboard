/// <reference types="vitest/config" />
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev-only middleware serving a freshly *generated* synthetic dataset to the
 * shell (spec §7.3 local mode: synthetic data only). apply:'serve' means it
 * cannot exist in any production bundle or preview build.
 *
 * When no generated dataset exists (`seed/output/current/`, e.g. a fresh clone
 * that hasn't run `npm run seed:generate`), each handler calls next() so Vite's
 * static serving falls through to the committed demo data in `public/dev-data/`.
 * That committed copy is the same dataset the GitHub Pages build ships, so the
 * app shows data everywhere without requiring the generator to run first.
 */
function devSyntheticData(): Plugin {
  const currentDir = () => path.resolve('seed/output/current')
  return {
    name: 'dev-synthetic-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-data/canonical.json', (_req, res, next) => {
        readFile(path.join(currentDir(), 'canonical.json'))
          .then((buf) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(buf)
          })
          // fall through to public/dev-data/canonical.json (committed demo data)
          .catch(() => next())
      })
      // Generated sample files for the local Import page (§13: the demo season
      // enters through the real import pipeline)
      server.middlewares.use('/dev-data/fixtures.json', (_req, res, next) => {
        readdir(path.join(currentDir(), 'fixtures'))
          .then((names) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(names.filter((n) => n.endsWith('.csv')).sort()))
          })
          // fall through to committed public/dev-data/fixtures.json
          .catch(() => next())
      })
      server.middlewares.use('/dev-data/fixtures/', (req, res, next) => {
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
          // fall through to committed public/dev-data/fixtures/<name>
          .catch(() => next())
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devSyntheticData()],
  // honor a harness-assigned PORT so parallel sessions don't collide on 5173
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  // PGlite ships its own WASM assets; pre-bundling breaks their resolution
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  test: {
    environment: 'node',
    // PGlite (in-process Postgres) compiles its WASM on first use, which can
    // exceed vitest's 5s default on a cold run and flake the DB-backed suites.
    testTimeout: 20000,
    hookTimeout: 20000,
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'db/**/*.test.ts',
      'seed/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
  },
})
