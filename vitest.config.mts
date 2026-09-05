import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // El núcleo del dominio es código puro: no necesita DOM ni navegador.
    include: ['src/**/*.test.ts'],
  },
})
