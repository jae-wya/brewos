import { describe, it, expect } from 'vitest'
import { parsePickup, orderHeat, pickupText } from './heat'

// All in the phone's local time, which on her phone is Asia/Manila.
const at = (h: number, m = 0) => { const d = new Date(2026, 9, 13, h, m, 0, 0); return d }
const order = (createdAt: Date, notes: string | null, status = 'pending') => ({ status, created_at: createdAt.toISOString(), notes })
const after = (d: Date, min: number) => new Date(d.getTime() + min * 60_000)

describe('parsePickup', () => {
  const ordered = at(14, 10)
  const due = (t: string) => { const p = parsePickup(t, ordered); return p.kind === 'at' ? `${p.at.getHours()}:${String(p.at.getMinutes()).padStart(2, '0')}` : p.kind }

  it('reads clock times', () => {
    expect(due('3pm')).toBe('15:00')
    expect(due('3:30 pm')).toBe('15:30')
    expect(due('3:30')).toBe('15:30')       // no am/pm: the next 3:30 after the order
    expect(due('at 4')).toBe('16:00')
    expect(due('mamayang 5')).toBe('17:00')
    expect(due('15:45')).toBe('15:45')
    expect(due('10am')).toBe('10:00')
  })

  it('reads plain durations from when it was ordered', () => {
    expect(due('in 30 mins')).toBe('14:40')
    expect(due('in an hour')).toBe('15:10')
    expect(due('isang oras')).toBe('15:10')
    expect(due('2 hrs')).toBe('16:10')
  })

  it('treats ranges and vague words as vague, not as a time', () => {
    expect(due('an hour or two')).toBe('vague')
    expect(due('1-2 hours')).toBe('vague')
    expect(due('30 to 45 mins')).toBe('vague')
    expect(due('later')).toBe('vague')
    expect(due('2')).toBe('vague')          // a bare number isn't a time
  })

  it('knows tomorrow', () => {
    expect(due('tomorrow 9am')).toBe('tomorrow')
    expect(due('bukas')).toBe('tomorrow')
  })

  it('finds the pickup line in order notes', () => {
    expect(pickupText('Pickup: in an hour or two')).toBe('in an hour or two')
    expect(pickupText('less ice')).toBeNull()
    expect(pickupText(null)).toBeNull()
  })
})

describe('orderHeat — walk-in, no pickup time: elapsed', () => {
  const o = order(at(14), null)
  it.each([[0, 0, 'Just now'], [2, 0, '2 min'], [3, 1, '3 min'], [6, 2, '6 min'], [9, 2, '9 min'], [10, 3, 'Waiting 10 min'], [75, 3, 'Waiting 1 h 15 min']])(
    'at %i min: level %i, "%s"', (min, level, label) => {
      expect(orderHeat(o, after(at(14), min))).toEqual({ level, label })
    })
})

describe('orderHeat — pickup time given: lateness', () => {
  // Paid at 2:00 for pickup at 3pm: a whole hour of legitimately waiting.
  const o = order(at(14), 'Pickup: 3pm')
  it('is cool for most of the wait, even long past 10 minutes', () => {
    expect(orderHeat(o, at(14, 30)).level).toBe(0)
    expect(orderHeat(o, at(14, 44)).level).toBe(0)
  })
  it('warms as the pickup time nears', () => {
    expect(orderHeat(o, at(14, 46))).toEqual({ level: 1, label: 'Due in 14 min' })
    expect(orderHeat(o, at(14, 56))).toEqual({ level: 2, label: 'Due in 4 min' })
  })
  it('is hot once past', () => {
    expect(orderHeat(o, at(15))).toEqual({ level: 3, label: 'Due now' })
    expect(orderHeat(o, at(15, 7))).toEqual({ level: 3, label: 'Late 7 min' })
  })
})

describe('orderHeat — vague pickup: a long fuse, never hot on elapsed minutes', () => {
  const o = order(at(14), 'Pickup: an hour or two')
  it('stays cool well past ten minutes', () => {
    expect(orderHeat(o, at(14, 10)).level).toBe(0)
    expect(orderHeat(o, at(15, 29)).level).toBe(0)
  })
  it('warms at 90 and 120 minutes, hot at 3 hours', () => {
    expect(orderHeat(o, at(15, 30)).level).toBe(1)
    expect(orderHeat(o, at(16)).level).toBe(2)
    expect(orderHeat(o, at(17))).toEqual({ level: 3, label: 'Waiting 3 h' })
  })
})

describe('orderHeat — never hot', () => {
  it('for tomorrow', () => {
    expect(orderHeat(order(at(14), 'Pickup: bukas'), at(23)).level).toBe(0)
  })
  it('once ready: waiting on the customer is not late', () => {
    expect(orderHeat(order(at(14), null, 'ready'), at(16)).level).toBe(0)
  })
})
