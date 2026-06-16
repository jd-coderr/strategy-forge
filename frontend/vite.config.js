import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'www.iknowquantfu.com',
      'iknowquantfu.com',
      'www.bergmanntrading.com',
      'bergmanntrading.com'
    ]
  },
  server: {
    allowedHosts: [
      'www.iknowquantfu.com',
      'iknowquantfu.com',
      'www.bergmanntrading.com',
      'bergmanntrading.com'
    ]
  }
})