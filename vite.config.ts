import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/lyrics/', // served at allenliu.dev/lyrics
  plugins: [react()],
  test: { globals: true },
})
