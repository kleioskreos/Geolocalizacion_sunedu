import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  preview: { port: 5191, strictPort: true },
  server: { host: '127.0.0.1', port: 5190, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8090' } },
})
