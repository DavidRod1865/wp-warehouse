/**
 * useTheme — Manages light/dark theme preference.
 *
 * Persists to localStorage and applies data-theme attribute to <html>.
 */
import { useState, useEffect, useCallback } from 'react'

type Theme = 'withpride' | 'withpride-dark'

const STORAGE_KEY = 'wp-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'withpride'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'withpride' || stored === 'withpride-dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'withpride-dark'
    : 'withpride'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'withpride' ? 'withpride-dark' : 'withpride'))
  }, [])

  const isDark = theme === 'withpride-dark'

  return { theme, setTheme: setThemeState, toggleTheme, isDark }
}
