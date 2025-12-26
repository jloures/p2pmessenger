import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  define: {
    APP_VERSION: JSON.stringify('1.' + (process.env.VITE_APP_BUILD_NUMBER || '0') + '.0')
  }
})
