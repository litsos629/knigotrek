#!/usr/bin/env node

/**
 * Скрипт генерации иконок для electron-builder.
 * Создаёт PNG иконки из SVG для всех платформ.
 *
 * Требует: sharp (npm install -D sharp)
 * Использование: node scripts/generate-icons.js
 *
 * electron-builder автоматически конвертирует PNG 512x512 в:
 * - .ico для Windows
 * - .icns для macOS
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BUILD_DIR = join(process.cwd(), 'build')
const PUBLIC_ICONS_DIR = join(process.cwd(), 'public', 'icons')
// Размеры для веба/PWA: favicon (16/32), apple-touch-icon (180), PWA (192/512)
const PUBLIC_SIZES = [16, 32, 180, 192, 512]

// Создаём SVG-иконку приложения "Книготрек"
const createAppIcon = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="url(#bg)"/>
  <!-- Книга -->
  <g transform="translate(100, 80)">
    <path d="M156 0 C80 0 20 20 20 20 L20 300 C20 300 80 280 156 280 C232 280 292 300 292 300 L292 20 C292 20 232 0 156 0Z" fill="white" opacity="0.95"/>
    <line x1="156" y1="10" x2="156" y2="280" stroke="#6366f1" stroke-width="3" opacity="0.3"/>
    <!-- Строки текста -->
    <g opacity="0.2" stroke="#4f46e5" stroke-width="8" stroke-linecap="round">
      <line x1="50" y1="60" x2="130" y2="60"/>
      <line x1="50" y1="90" x2="120" y2="90"/>
      <line x1="50" y1="120" x2="140" y2="120"/>
      <line x1="180" y1="60" x2="260" y2="60"/>
      <line x1="180" y1="90" x2="250" y2="90"/>
      <line x1="180" y1="120" x2="240" y2="120"/>
    </g>
  </g>
  <!-- Карандаш -->
  <g transform="translate(300, 260) rotate(45)">
    <rect x="0" y="0" width="24" height="120" rx="4" fill="#fbbf24"/>
    <polygon points="0,120 12,150 24,120" fill="#f59e0b"/>
    <polygon points="8,140 12,150 16,140" fill="#374151"/>
    <rect x="0" y="0" width="24" height="15" rx="4" fill="#f472b6"/>
  </g>
  <!-- Прогресс-бар -->
  <rect x="120" y="420" width="272" height="24" rx="12" fill="white" opacity="0.3"/>
  <rect x="120" y="420" width="190" height="24" rx="12" fill="white" opacity="0.9"/>
</svg>`

async function generateIcons() {
  console.log('🎨 Генерация иконок...\n')

  mkdirSync(BUILD_DIR, { recursive: true })

  try {
    // Попробуем использовать sharp для конвертации SVG → PNG
    const sharp = await import('sharp')

    const svgBuffer = Buffer.from(createAppIcon(512))

    // Основная иконка 512x512 (electron-builder конвертирует в ico/icns)
    await sharp.default(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(join(BUILD_DIR, 'icon.png'))
    console.log('  ✅ build/icon.png (512x512)')

    // Дополнительные размеры для Linux
    for (const size of [16, 32, 48, 64, 128, 256]) {
      const sizeBuffer = Buffer.from(createAppIcon(size))
      await sharp.default(sizeBuffer)
        .resize(size, size)
        .png()
        .toFile(join(BUILD_DIR, `${size}x${size}.png`))
    }
    console.log('  ✅ Иконки для Linux (16-256px)')

    // Иконки для веба/PWA (favicon, apple-touch-icon, manifest)
    mkdirSync(PUBLIC_ICONS_DIR, { recursive: true })
    for (const size of PUBLIC_SIZES) {
      await sharp.default(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(PUBLIC_ICONS_DIR, `${size}.png`))
    }
    writeFileSync(join(PUBLIC_ICONS_DIR, 'icon.svg'), createAppIcon(512))
    console.log('  ✅ Иконки для веба/PWA в public/icons/ (+ SVG-favicon)')

    console.log('\n✅ Все иконки сгенерированы в build/ и public/icons/')
    console.log('   electron-builder автоматически создаст .ico и .icns')
  } catch {
    // Если sharp не установлен, сохраняем SVG — electron-builder может с ним работать
    console.log('  ⚠️  sharp не установлен, сохраняю SVG иконку')
    writeFileSync(join(BUILD_DIR, 'icon.svg'), createAppIcon(512))
    console.log('  ✅ build/icon.svg')
    console.log('\n  Для генерации PNG установите: npm install -D sharp')
  }
}

generateIcons()
