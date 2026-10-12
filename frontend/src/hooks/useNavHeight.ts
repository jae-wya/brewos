import { useEffect, useState } from 'react'

// The bottom nav's real height (it includes the phone's safe area), so bars
// pinned above it sit exactly on it instead of guessing a number.
export function useNavHeight(fallback = 58): number {
  const [height, setHeight] = useState(fallback)
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Main navigation"]')
    if (!nav) return
    const update = () => setHeight(nav.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [])
  return height
}
