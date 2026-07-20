import { ref, watch } from 'vue'
import { THEMES, THEME_STORAGE_KEY } from '../data/themes'

function getInitialTheme(): string {
  const current = document.documentElement.dataset.theme
  if (current && THEMES.some((t) => t.id === current)) return current
  return 'dark'
}

// 模块级单例,全站共享
const theme = ref(getInitialTheme())

watch(theme, (id) => {
  document.documentElement.dataset.theme = id
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
})

export function useTheme() {
  return { theme }
}
