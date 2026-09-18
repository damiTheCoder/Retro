import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __OPENROUTER_API_KEY__: JSON.stringify(
      process.env.OPENROUTER_API_KEY ||
      process.env.openrouter ||
      process.env.OPENROUTER ||
      process.env.VITE_OPENROUTER_API_KEY ||
      process.env.openrouter_api_key ||
      ''
    ),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
