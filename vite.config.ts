import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages de proyecto sirve desde /Finanzas/; en desarrollo la base es '/'.
const base = process.env.GITHUB_PAGES === 'true' ? '/Finanzas/' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
