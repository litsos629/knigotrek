import { describe, it, expect } from 'vitest'
import { tsToMillis, tsToIso } from '../cloudSyncService'

describe('cloudSyncService — нормализация меток времени', () => {
  it('парсит ISO-метку', () => {
    expect(tsToMillis('2026-06-11T20:15:30.000Z')).toBe(Date.UTC(2026, 5, 11, 20, 15, 30))
  })

  it('парсит SQLite-формат "YYYY-MM-DD HH:MM:SS" как UTC', () => {
    expect(tsToMillis('2026-06-11 20:15:30')).toBe(Date.UTC(2026, 5, 11, 20, 15, 30))
  })

  it('SQLite-метка позже ISO-метки того же дня сравнивается корректно', () => {
    // Регресс прежнего бага: строковое сравнение давало ' ' < 'T' и
    // изменения того же дня не пушились до следующих суток
    const sqliteEvening = tsToMillis('2026-06-11 23:59:59')
    const isoMorning = tsToMillis('2026-06-11T00:00:00.000Z')
    expect(sqliteEvening).toBeGreaterThan(isoMorning)
  })

  it('пустые/битые значения дают 0', () => {
    expect(tsToMillis(undefined)).toBe(0)
    expect(tsToMillis(null)).toBe(0)
    expect(tsToMillis('')).toBe(0)
    expect(tsToMillis('мусор')).toBe(0)
  })

  it('tsToIso конвертирует SQLite-формат в ISO', () => {
    expect(tsToIso('2026-06-11 20:15:30')).toBe('2026-06-11T20:15:30.000Z')
  })

  it('tsToIso для пустого значения возвращает валидный ISO (текущее время)', () => {
    const iso = tsToIso(undefined)
    expect(Number.isNaN(Date.parse(iso))).toBe(false)
  })
})
