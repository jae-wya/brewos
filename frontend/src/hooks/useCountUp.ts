import { useEffect, useRef, useState } from 'react'

// With reduced motion on, numbers appear at their value instead of counting
// up. CSS can't stop this one: it's driven from JavaScript, frame by frame.
const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  const prev = useRef(prefersReducedMotion() ? target : 0)

  useEffect(() => {
    if (target === prev.current) return
    if (prefersReducedMotion()) {
      prev.current = target
      setValue(target)
      return
    }
    const start = prev.current
    const diff = target - start
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + diff * eased))
      if (progress < 1) requestAnimationFrame(tick)
      else prev.current = target
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return value
}
