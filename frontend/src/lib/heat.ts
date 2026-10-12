// How late an order is running, as heat on its chit (Queue page): the
// longer past due, the warmer the paper. Heat measures LATENESS, not
// waiting — a Messenger order paid now for pickup "in an hour or two" is not
// late at ten minutes, and if it glowed red the signal would be noise by
// lunchtime. No imports, so it can be tested on its own.
//
//   No pickup time (walk-in)    elapsed time: warm at 3 and 6 min, hot at 10
//   A time ("3pm", "in 30 min") cool until 15 min before; warming as it
//                               nears; hot once it's past
//   Vague ("an hour or two")    can't be read as a time: a long fuse — cool
//                               for 90 min, warm at 90/120, hot at 3 hours
//   "Tomorrow" / "bukas"        cool
//   Ready / picked up / cancelled: cool. Waiting on the customer isn't late.
//
// The minutes are always written on the chit too: colour is never the only
// signal.

export type HeatLevel = 0 | 1 | 2 | 3
export interface Heat {
  level: HeatLevel
  label: string   // what the chit says about time: "4 min", "Due in 12 min", "Late 5 min"
}

export type Pickup =
  | { kind: 'none' }
  | { kind: 'at', at: Date }
  | { kind: 'vague' }
  | { kind: 'tomorrow' }

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, isang: 1, isa: 1, two: 2, dalawang: 2, dalawa: 2 }
const minutes = (n: number) => n * 60_000

// Orders carry pickup as order notes: "Pickup: <what she typed>".
export function pickupText(notes: string | null): string | null {
  const m = notes?.match(/^\s*Pickup:\s*(.+)$/im)
  return m ? m[1].trim() : null
}

export function parsePickup(text: string | null, ordered: Date): Pickup {
  if (!text) return { kind: 'none' }
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim()
  if (/\b(tomorrow|bukas)\b/.test(t)) return { kind: 'tomorrow' }

  // A range ("an hour or two", "1-2 hours", "30 to 45 mins") is not a time.
  const isRange = /\bor\b|\d\s*(-|–|to)\s*\d|\bto\b/.test(t)

  // "in 30 mins", "after an hour", "isang oras", "2 hrs"
  const rel = t.match(/\b(\d{1,3}|an?|one|isang?|two|dalawang?)\s*(m|mins?|minutes?|h|hrs?|hours?|oras)\b/)
  if (rel && !isRange) {
    const n = /^\d+$/.test(rel[1]) ? Number(rel[1]) : NUMBER_WORDS[rel[1]]
    const unitMinutes = /^(m|mins?|minutes?)$/.test(rel[2]) ? 1 : 60
    if (n) return { kind: 'at', at: new Date(ordered.getTime() + minutes(n * unitMinutes)) }
  }

  // "3pm", "3:30", "3:30 pm", "at 4", "mamayang 4", "by 5"
  const clock = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?(?=\b|\s|$)/)
  const anchored = clock && (clock[2] || clock[3] || /\b(at|by|around|mamayang?|bandang)\s+\d/.test(t))
  if (clock && anchored && !isRange) {
    let h = Number(clock[1])
    const m = clock[2] ? Number(clock[2]) : 0
    if (h > 23 || m > 59) return { kind: 'vague' }
    const mer = clock[3]?.replace(/\./g, '')
    if (mer === 'pm' && h < 12) h += 12
    if (mer === 'am' && h === 12) h = 0
    const at = new Date(ordered); at.setHours(h, m, 0, 0)
    // No am/pm on 1-11: a café's "at 4" is the next 4 after the order.
    if (!mer && h >= 1 && h <= 11 && at.getTime() < ordered.getTime() - minutes(30)) at.setHours(h + 12)
    return { kind: 'at', at }
  }

  return { kind: 'vague' }
}

const clockLabel = (d: Date) => d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
const span = (min: number) => min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`

export function orderHeat(order: { status: string, created_at: string, notes: string | null }, now: Date): Heat {
  const ordered = new Date(order.created_at)
  const waited = Math.max(0, Math.floor((now.getTime() - ordered.getTime()) / 60_000))
  if (!['pending', 'brewing'].includes(order.status)) return { level: 0, label: span(waited) }

  const pickup = parsePickup(pickupText(order.notes), ordered)
  switch (pickup.kind) {
    case 'tomorrow':
      return { level: 0, label: 'For tomorrow' }
    case 'at': {
      const toGo = Math.ceil((pickup.at.getTime() - now.getTime()) / 60_000) // minutes until due
      if (toGo > 15) return { level: 0, label: `Pickup ${clockLabel(pickup.at)}` }
      if (toGo > 5) return { level: 1, label: `Due in ${toGo} min` }
      if (toGo > 0) return { level: 2, label: `Due in ${toGo} min` }
      if (toGo === 0) return { level: 3, label: 'Due now' }
      return { level: 3, label: `Late ${span(-toGo)}` }
    }
    case 'vague': {
      const level: HeatLevel = waited >= 180 ? 3 : waited >= 120 ? 2 : waited >= 90 ? 1 : 0
      return { level, label: level === 3 ? `Waiting ${span(waited)}` : `${span(waited)} ago` }
    }
    case 'none': {
      const level: HeatLevel = waited >= 10 ? 3 : waited >= 6 ? 2 : waited >= 3 ? 1 : 0
      return { level, label: level === 3 ? `Waiting ${span(waited)}` : waited < 1 ? 'Just now' : `${span(waited)}` }
    }
  }
}
