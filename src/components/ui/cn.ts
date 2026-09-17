/**
 * Join class names, dropping anything falsy.
 *
 * Deliberately not `clsx` + `tailwind-merge`: the components in this project
 * compose their classes in one place and never need conflicting utilities
 * resolved, so a five-line helper avoids two dependencies.
 */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}
