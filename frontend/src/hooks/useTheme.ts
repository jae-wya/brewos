import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('brewos-theme') as Theme) ?? 'dark'
    } catch { return 'dark' }
  })

  useEffect(() => {
    // Always set explicit value — empty string causes selector mismatch
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('brewos-theme', theme) } catch {}
  }, [theme])

  // Also set on first mount before React hydrates
  useEffect(() => {
    const saved = localStorage.getItem('brewos-theme') ?? 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return { theme, toggle }
}
