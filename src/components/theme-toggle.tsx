'use client'

import { useSyncExternalStore } from 'react'

import { THEME_STORAGE_KEY } from './theme-script'
import { cn } from './ui/cn'

type Theme = 'light' | 'dark'

/**
 * Light/dark switch.
 *
 * The theme lives on `<html data-theme>`, which `ThemeScript` sets before the
 * first paint. That attribute — not React state — is the source of truth, so
 * this reads it through `useSyncExternalStore`: during hydration the server
 * snapshot is `null` and nothing is rendered, and immediately afterwards the
 * button shows the icon that matches what is actually on screen. There is no
 * moment where the two disagree.
 */
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/** The server cannot know the theme, so it renders no icon at all. */
function getServerSnapshot(): Theme | null {
  return null
}

function applyTheme(next: Theme): void {
  document.documentElement.setAttribute('data-theme', next)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Private browsing can refuse storage. The theme still applies to this page
    // view; it just will not be remembered.
  }
  for (const listener of listeners) listener()
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme | null>(subscribe, getSnapshot, getServerSnapshot)

  return (
    <button
      type="button"
      onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'rounded-sharp inline-flex size-9 items-center justify-center',
        'border border-border-strong text-ink-muted',
        'transition-colors duration-150 hover:border-border-loud hover:text-ink',
      )}
    >
      {theme === null ? null : theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}
