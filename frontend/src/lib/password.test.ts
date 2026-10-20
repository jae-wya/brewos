import { describe, it, expect } from 'vitest'
import { newPasswordProblem } from './password'

describe('newPasswordProblem', () => {
  it('accepts a good change', () => {
    expect(newPasswordProblem('old-pass-1', 'new-pass-22', 'new-pass-22')).toBeNull()
  })
  it('needs the current password', () => {
    expect(newPasswordProblem('', 'new-pass-22', 'new-pass-22')).toBe('Enter your current password.')
  })
  it('refuses a short, blank or overlong one, in the server\'s words', () => {
    expect(newPasswordProblem('old-pass-1', 'short', 'short')).toBe('New password must be at least 8 characters.')
    expect(newPasswordProblem('old-pass-1', '          ', '          ')).toBe("New password can't be only spaces.")
    expect(newPasswordProblem('old-pass-1', 'x'.repeat(73), 'x'.repeat(73))).toBe('New password is too long. Keep it under 70 characters.')
  })
  it('counts bytes, not characters, for the length limit', () => {
    const peso = '₱'.repeat(25) // 3 bytes each: 75 bytes
    expect(newPasswordProblem('old-pass-1', peso, peso)).toBe('New password is too long. Keep it under 70 characters.')
  })
  it('refuses the same password', () => {
    expect(newPasswordProblem('same-pass-1', 'same-pass-1', 'same-pass-1')).toBe('New password must be different from the current one.')
  })
  it('catches a typo in the second copy', () => {
    expect(newPasswordProblem('old-pass-1', 'new-pass-22', 'new-pass-23')).toBe("The two new passwords don't match.")
  })
})
