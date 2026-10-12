import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setAvailability, pendingAvailability, shownAvailability, DEBOUNCE_MS } from './availabilityWrites'

// One switch and a fake server with a set latency. Each test uses its own key:
// pending writes live in a module-level map that outlasts a test.
let n = 0
function harness(initial: boolean, latency = 100) {
  const key = `item:test-${++n}`
  const h = {
    key, screen: initial, server: initial, latency, failNext: false,
    shows: [] as boolean[], requests: [] as boolean[], errors: [] as boolean[], inFlight: 0, maxInFlight: 0,
    tap() {
      setAvailability(key, h.screen, !h.screen, {
        send: v => new Promise((resolve, reject) => {
          h.requests.push(v); h.inFlight++; h.maxInFlight = Math.max(h.maxInFlight, h.inFlight)
          const fail = h.failNext; h.failNext = false
          setTimeout(() => {
            h.inFlight--
            if (fail) return reject(new Error('network'))
            h.server = v; resolve(v)
          }, h.latency)
        }),
        show: v => { h.shows.push(v); h.screen = v },
        onFailed: v => h.errors.push(v),
      })
    },
  }
  return h
}
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms)

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('menu toggle writes', () => {
  it('off, on, off within a second: ends off, one request, no flicker', async () => {
    const h = harness(true)
    h.tap(); await wait(300); h.tap(); await wait(300); h.tap()
    await wait(1000)
    expect(h.requests).toEqual([false])
    expect(h.server).toBe(false)
    expect(h.screen).toBe(false)
    expect(h.shows).toEqual([false, true, false, false]) // last = the server's confirmation, same value
    expect(h.errors).toEqual([])
  })

  it('off, on: no request at all', async () => {
    const h = harness(true)
    h.tap(); await wait(100); h.tap()
    await wait(DEBOUNCE_MS + 500)
    expect(h.requests).toEqual([])
    expect(h.screen).toBe(true)
  })

  it('failure rolls back with an error', async () => {
    const h = harness(true); h.failNext = true
    h.tap(); await wait(DEBOUNCE_MS + 500)
    expect(h.screen).toBe(true)
    expect(h.server).toBe(true)
    expect(h.errors).toEqual([false])
  })

  it('slow server, taps 500ms apart: one request at a time, newest wins, stale result not shown', async () => {
    const h = harness(true, 2000) // a Render cold start
    h.tap(); await wait(500)   // off sent
    h.tap(); await wait(500)   // on wanted while off is in flight
    h.tap(); await wait(500)   // off again
    h.tap()                    // on: the final value
    await wait(6000)
    expect(h.maxInFlight).toBe(1)
    expect(h.requests).toEqual([false, true])
    expect(h.server).toBe(true)
    expect(h.screen).toBe(true)
    expect(h.shows).toEqual([false, true, false, true, true]) // off's response never shown
  })

  it('rollback goes to the server value, not the value on screen when the request started', async () => {
    const h = harness(true, 600)
    h.tap(); await wait(500)      // off sent; it will succeed
    h.tap(); h.failNext = true    // on wanted; that request will fail
    await wait(2500)
    expect(h.requests).toEqual([false, true])
    expect(h.server).toBe(false)
    expect(h.screen).toBe(false)  // screen showed "on" when the failing request started
    expect(h.errors).toEqual([true])
  })

  it('shows the pending value over the cached one until the write settles', async () => {
    const h = harness(true)
    expect(pendingAvailability(h.key)).toBeUndefined()
    h.tap()
    const id = h.key.slice('item:'.length)
    expect(shownAvailability('item', id, true)).toBe(false)   // a reload saying "on" doesn't win
    await wait(DEBOUNCE_MS + 500)
    expect(pendingAvailability(h.key)).toBeUndefined()
    expect(shownAvailability('item', id, false)).toBe(false)  // settled: the cache decides
  })
})
