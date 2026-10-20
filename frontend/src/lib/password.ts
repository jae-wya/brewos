// What the Settings password form can check before asking the server. Same
// sentences as the backend (routers/auth.py, change_password), which checks
// again. null = nothing wrong that we can see from here.
export const PASSWORD_MIN = 8

export function newPasswordProblem(current: string, next: string, again: string): string | null {
  if (!current) return 'Enter your current password.'
  if (next.length < PASSWORD_MIN) return `New password must be at least ${PASSWORD_MIN} characters.`
  if (!next.trim()) return "New password can't be only spaces."
  if (new TextEncoder().encode(next).length > 72) return 'New password is too long. Keep it under 70 characters.'
  if (next === current) return 'New password must be different from the current one.'
  // Typed twice: a typo here locks her out until Jae resets it.
  if (next !== again) return "The two new passwords don't match."
  return null
}
