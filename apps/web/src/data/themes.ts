export interface ThemeDef {
  id: string
  name: string
  /** 切换面板里的色板预览点:页面底色 + 两个品牌色 */
  swatch: [string, string, string]
}

export const THEMES: ThemeDef[] = [
  { id: 'dark', name: '深色 · 默认', swatch: ['#09090b', '#8b5cf6', '#22d3ee'] },
  { id: 'light', name: '明亮', swatch: ['#ffffff', '#7c3aed', '#0891b2'] },
  { id: 'paper', name: '纸质', swatch: ['#faf7f0', '#b45309', '#0f766e'] },
  { id: 'mint', name: '薄荷', swatch: ['#f0fbf6', '#059669', '#0891b2'] },
  { id: 'sky', name: '天空', swatch: ['#f3f8ff', '#2563eb', '#0891b2'] },
  { id: 'sakura', name: '樱花', swatch: ['#fff5f8', '#db2777', '#7c3aed'] },
]

export const THEME_STORAGE_KEY = 'siteforge.theme'
