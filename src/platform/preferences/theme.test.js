import { describe, expect, it } from 'vitest'
import { resolveTheme } from './theme'

describe('browser theme resolution', () => {
  it('follows the device until overridden', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })
})
