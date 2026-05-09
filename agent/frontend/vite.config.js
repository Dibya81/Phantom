import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'https://phantom-mlxh.onrender.com', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/ws':  { target: 'wss://phantom-mlxh.onrender.com',   ws: true }
    }
  }
})
