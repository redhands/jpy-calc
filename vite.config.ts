import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/jpy-calc/', // GitHub Pages 저장소 이름
  server: {
    host: '0.0.0.0', // 내부 네트워크 접속 허용
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
