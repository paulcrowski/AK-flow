import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serveAkFlowState = () => {
  const configDir = path.dirname(fileURLToPath(import.meta.url))
  const statePath = path.resolve(configDir, 'data', 'ak-flow-state.json')

  return {
    name: 'serve-ak-flow-state',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = typeof req.url === 'string' ? req.url : ''
        if (!url.startsWith('/ak-flow-state.json')) return next()

        fs.readFile(statePath, 'utf-8', (err, content) => {
          if (err) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'ak-flow-state.json not found' }))
            return
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(content)
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), serveAkFlowState()],
  publicDir: 'data',
  server: {
    port: 3001,
    open: true,
    host: '::'
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
