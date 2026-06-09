import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
  },
  resolve: {
    alias: {
      '@3dm/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
})
