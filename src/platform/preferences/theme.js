// Browser preference only; this never changes account or journal records.
export const THEME_KEY = 'apexlog-theme'
let transientPreference

export function resolveTheme(preference, prefersLight) {
  return preference === 'dark' || preference === 'light' ? preference : prefersLight ? 'light' : 'dark'
}

export function getThemePreference() {
  if (transientPreference) return transientPreference
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return ['dark', 'light'].includes(saved) ? saved : 'system'
  } catch { return 'system' }
}

function applyTheme() {
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  const theme = resolveTheme(getThemePreference(), prefersLight)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f3ee' : '#0d1013')
}

export function setThemePreference(value) {
  if (!['system', 'dark', 'light'].includes(value)) return
  transientPreference = value
  try { localStorage.setItem(THEME_KEY, value) } catch { /* The choice still applies this visit. */ }
  document.documentElement.dataset.themePreference = value
  applyTheme()
  window.dispatchEvent(new Event('apex-theme-change'))
}

export function initializeTheme() {
  document.documentElement.dataset.themePreference = getThemePreference()
  applyTheme()
  const media = window.matchMedia('(prefers-color-scheme: light)')
  media.addEventListener('change', applyTheme)
}
