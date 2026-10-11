// The owner's login session, kept in localStorage.
//
// localStorage is a deliberate choice, not a shortcut:
//   * An httpOnly cookie would have to cross from brewos-mu.vercel.app to
//     brewos-api.onrender.com — a cross-site cookie needing CORS credentials,
//     SameSite=None and Secure on the API, plus CSRF protection. That is real
//     work for no gain here.
//   * The usual argument for httpOnly is XSS stealing the token. This app
//     renders no user-supplied HTML (React escapes everything; there is no
//     dangerouslySetInnerHTML), so there is no injection path to the token.
//   * It survives closing the PWA, so she isn't asked to log in every shift.
//     Tokens last 30 days; a lost phone is handled by rotating JWT_SECRET.
//
// Revisit this if the app ever renders HTML from users or a third party.

const KEY = 'brewos.session'

export interface Session {
  access_token: string
  display_name: string
}

function readStored(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return typeof s?.access_token === 'string' ? s : null
  } catch {
    return null
  }
}

// In-memory copy is the source of truth, so a blocked localStorage still
// works for the rest of this visit.
let _current: Session | null = readStored()

export function getSession(): Session | null {
  return _current
}

export function saveSession(s: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Storage blocked (private mode): she stays logged in until the app closes.
  }
  _current = s
}

export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
  _current = null
}
