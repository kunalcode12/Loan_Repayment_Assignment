/**
 * Applies the stored (or system) theme to <html> before the first paint.
 *
 * This runs as a blocking inline script rather than in an effect, because an
 * effect runs after paint and the user would see a flash of the light theme
 * before the dark one is applied.
 */
const SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem('loan-service-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`

export const THEME_STORAGE_KEY = 'loan-service-theme'

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
}
