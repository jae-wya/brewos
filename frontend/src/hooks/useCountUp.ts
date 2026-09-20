import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    if (target === prev.current) return
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
