import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import i18n from '../i18n'

// Расширяем expect matchers
expect.extend(matchers)

// Детерминируем язык для тестов — UI-ассерты рассчитаны на русский
i18n.changeLanguage('ru')

// Очистка после каждого теста
afterEach(() => {
  cleanup()
  // Очищаем localStorage
  localStorage.clear()
})

// Мокаем window.electronAPI для тестов
Object.defineProperty(window, 'electronAPI', {
  value: undefined,
  writable: true,
  configurable: true
})
