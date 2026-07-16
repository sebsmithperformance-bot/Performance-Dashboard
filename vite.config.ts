/// <reference types="vitest/config" />
import { readFile } from 'node:fs/promises'
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
  return {
    name: 'dev-synthetic-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/dev-data/canonical.json', (_req, res) => {
        readFile(path.resolve('seed/output/current/canonical.json'))
          .then((buf) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(buf)
          })
          .catch(() => {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'No generated dataset. Run: npm run seed:generate' }))
          })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devSyntheticData()],
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
