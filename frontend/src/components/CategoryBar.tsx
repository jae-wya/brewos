import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// A horizontal row of category chips that says when there's more: a fade
// with a chevron on whichever edge hides chips (thirteen categories don't
// fit a phone, and a chip cut off mid-word gave no sign of the rest). The
// active chip scrolls into view.
//
//   kind="tabs"  the order screen: chips switch the visible category
//   kind="jump"  the Menu page: chips jump to a section of one long list
//
// Where it sits is the caller's choice; both callers pin it near the thumb.
export default function CategoryBar({ cats, active, onPick, kind, label }: {
  cats: { id: string, name: string }[]
  active: string | undefined
  onPick: (id: string) => void
  kind: 'tabs' | 'jump'
  label: string
}) {
  const bar = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState({ left: false, right: false })
  const measure = () => {
    const el = bar.current
    if (!el) return
    setMore({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [cats.length])
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [active])

  const fade = (side: 'left' | 'right') => (
    <div aria-hidden="true" style={{
      position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 44, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: side === 'right' ? 'flex-end' : 'flex-start',
      padding: '0 4px', color: 'var(--t2)',
      background: `linear-gradient(to ${side}, transparent, var(--s1) 60%)`,
    }}>
      {side === 'right' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </div>
  )

  return (
    <div style={{ position: 'relative', background: 'var(--s1)', borderTop: '1px solid var(--border)' }}>
      <div ref={bar} onScroll={measure} className="scrollbar-none"
        role={kind === 'tabs' ? 'tablist' : 'navigation'} aria-label={label}
        style={{ padding: '8px 14px 10px', display: 'flex', gap: 8, overflowX: 'auto', scrollPaddingInline: 44 }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => onPick(c.id)} data-active={active === c.id}
            {...(kind === 'tabs'
              ? { role: 'tab', 'aria-selected': active === c.id }
              : { 'aria-current': active === c.id ? 'true' : undefined })}
            className={`chip flex-shrink-0 ${active === c.id ? 'chip-on' : ''}`}>
            {c.name}
          </button>
        ))}
      </div>
      {more.left && fade('left')}
      {more.right && fade('right')}
    </div>
  )
}
