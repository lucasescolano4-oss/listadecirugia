import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Necesario para que funcione con HashRouter en Vercel
  base: '/',

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          socket:  ['socket.io-client'],
          xlsx:    ['xlsx'],
        },
      },
    },
  },

  server: {
    port: 5173,
    // Proxy en desarrollo: evita CORS al llamar al servidor local
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
