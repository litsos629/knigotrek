import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Относительные пути обязательны: упакованный Electron грузит dist/index.html
  // через file:// из asar, и абсолютные "/assets/..." указывают в корень ФС → белый экран
  base: './',
})
