/**
 * Report visual themes for PDF and image generation.
 * 2 themes: Clean (minimalist), Dark (elegant dark)
 */

export type ThemeId = 'clean' | 'dark'

export interface ReportTheme {
  id: ThemeId
  name: string
  // PDF colors (RGB 0-255)
  pdf: {
    background: [number, number, number]
    headerBg: [number, number, number]
    headerText: [number, number, number]
    text: [number, number, number]
    textSecondary: [number, number, number]
    accent: [number, number, number]
    accentLight: [number, number, number]
    border: [number, number, number]
    cardBg: [number, number, number]
    tableFill: [number, number, number]
  }
  // Image/CSS colors (hex strings)
  image: {
    background: string
    gradient: string
    text: string
    textSecondary: string
    accent: string
    accentLight: string
    cardBg: string
    cardBorder: string
    statValueColor: string
    footerColor: string
  }
}

export const themes: Record<ThemeId, ReportTheme> = {
  clean: {
    id: 'clean',
    name: 'Clean',
    pdf: {
      background: [255, 255, 255],
      headerBg: [79, 70, 229],
      headerText: [255, 255, 255],
      text: [17, 24, 39],
      textSecondary: [107, 114, 128],
      accent: [79, 70, 229],
      accentLight: [238, 242, 255],
      border: [229, 231, 235],
      cardBg: [249, 250, 251],
      tableFill: [79, 70, 229],
    },
    image: {
      background: '#ffffff',
      gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      text: '#111827',
      textSecondary: '#6b7280',
      accent: '#4f46e5',
      accentLight: '#eef2ff',
      cardBg: '#f9fafb',
      cardBorder: '#e5e7eb',
      statValueColor: '#4f46e5',
      footerColor: '#9ca3af',
    },
  },

  dark: {
    id: 'dark',
    name: 'Dark',
    pdf: {
      background: [26, 26, 46],
      headerBg: [40, 40, 70],
      headerText: [255, 255, 255],
      text: [229, 231, 235],
      textSecondary: [156, 163, 175],
      accent: [6, 182, 212],
      accentLight: [20, 60, 80],
      border: [55, 65, 81],
      cardBg: [31, 41, 55],
      tableFill: [6, 182, 212],
    },
    image: {
      background: '#1a1a2e',
      gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      text: '#e5e7eb',
      textSecondary: '#9ca3af',
      accent: '#06b6d4',
      accentLight: '#164e63',
      cardBg: 'rgba(255,255,255,0.13)',
      cardBorder: 'rgba(6,182,212,0.3)',
      statValueColor: '#06b6d4',
      footerColor: 'rgba(255,255,255,0.5)',
    },
  },
}

export function getTheme(id: ThemeId): ReportTheme {
  return themes[id] || themes.clean
}
