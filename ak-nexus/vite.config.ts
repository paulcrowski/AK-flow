import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: 'data',
  server: {
    port: 3001,
    open: true,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
