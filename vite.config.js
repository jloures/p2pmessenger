import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  define: {
    APP_VERSION: JSON.stringify(process.env.VITE_APP_VERSION || 'dev-' + new Date().toISOString().split('T')[0])
  }
})
