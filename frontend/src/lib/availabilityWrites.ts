// Saves Menu page on/off switches. No React and no imports, so it can be
// tested on its own.
//
//   * The switch follows every tap at once; nothing is ever disabled.
//   * Writes wait DEBOUNCE_MS after the last tap, so off-on-off sends one
//     request with the final value, and off-on sends none at all.
//   * At most one request per item/option is in flight. If she taps again
//     meanwhile, her latest value goes out when it returns. Two requests in
//     flight could reach the server out of order (both queued behind a
//     Render cold start) and leave it holding the older value.
//   * A response for a value she has since changed is not shown.
//   * On failure the switch goes back to the last value the server
//     confirmed, not to whatever was on screen when the request started.

export const DEBOUNCE_MS = 400

export interface Handlers {
  send: (value: boolean) => Promise<boolean> // resolves to the server's value
  show: (value: boolean) => void             // put this value on screen
  onSaved: () => void
  onFailed: (value: boolean, err: unknown) => void
}

interface Pending {
  confirmed: boolean // last value the server is known to have
  wanted: boolean    // what the switch shows
  timer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
  handlers: Handlers // from the row tapped last, so its error shows there
}

// Keyed by item/option, not by row: one option can appear under many items.
// Lives outside React so a write still finishes if she leaves the page.
const pending = new Map<string, Pending>()

// What the switch should show while a write is pending, so a menu reload
// that lands mid-write can't flash the server's old value over her tap.
export function pendingAvailability(key: string): boolean | undefined {
  return pending.get(key)?.wanted
}

// `shown` is what the switch shows before this tap.
export function setAvailability(key: string, shown: boolean, next: boolean, handlers: Handlers) {
  let p = pending.get(key)
  if (!p) {
    // Nothing pending for it, so what's on screen is what the server has.
    p = { confirmed: shown, wanted: shown, timer: null, inFlight: false, handlers }
    pending.set(key, p)
  }
  const entry = p
  entry.handlers = handlers
  entry.wanted = next
  handlers.show(next)
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => { entry.timer = null; flush(key, entry) }, DEBOUNCE_MS)
}

function flush(key: string, p: Pending) {
  if (p.timer || p.inFlight) return // the timer, or the in-flight request, calls back here
  if (p.wanted === p.confirmed) { pending.delete(key); return }

  const value = p.wanted
  p.inFlight = true
  p.handlers.send(value).then(
    serverValue => { p.confirmed = serverValue; p.handlers.onSaved(); done(null, false) },
    err => done(err, true),
  )

  function done(err: unknown, failed: boolean) {
    p.inFlight = false
    if (p.timer || p.wanted !== value) { flush(key, p); return } // she's changed it since: ignore this result
    pending.delete(key)
    p.handlers.show(p.confirmed)
    if (failed) p.handlers.onFailed(value, err)
  }
}
