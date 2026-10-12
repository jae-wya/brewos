import { describe, it, expect } from 'vitest'
import { fillTemplate, unknownPlaceholders, itemLine, ComposerLine } from './composer'

// The backend's DEFAULT_TEMPLATE (app/routers/settings.py), verbatim.
const DEFAULT = `Hi po! Eto po yung order niyo:
{items}

Total: {total}
Pickup: {pickup}

Pa-send na lang po ng payment dito:
GCash: {gcash}
Maya: {maya}

Then send niyo lang po yung screenshot ng payment. Salamat po!`

const latte: ComposerLine = { quantity: 1, name: 'Spanish Latte', category: 'Iced Coffee', showCategory: true, modifiers: ['Medium (M)'], lineTotal: 120 }
const fries: ComposerLine = { quantity: 2, name: 'Flavored Fries', category: 'Snacks', showCategory: false, modifiers: ['BBQ'], lineTotal: 240 }
const base = { lines: [latte, fries], total: 360, pickup: 'in an hour or two', name: '', gcash: '0917 123 4567', maya: '0918 765 4321' }

describe('fillTemplate', () => {
  it('her example: one Iced Spanish Latte, medium, both numbers', () => {
    expect(fillTemplate(DEFAULT, { ...base, lines: [latte], total: 120 })).toBe(`Hi po! Eto po yung order niyo:
1x Spanish Latte (Iced Coffee) – Medium (M) — ₱120

Total: ₱120
Pickup: in an hour or two

Pa-send na lang po ng payment dito:
GCash: 0917 123 4567
Maya: 0918 765 4321

Then send niyo lang po yung screenshot ng payment. Salamat po!`)
  })

  it('names the category only for Hot/Iced twins', () => {
    const out = fillTemplate(DEFAULT, base)
    expect(out).toMatch(/^1x Spanish Latte \(Iced Coffee\) – Medium \(M\) — ₱120$/m)
    expect(out).toMatch(/^2x Flavored Fries – BBQ — ₱240$/m)
    expect(out).toMatch(/^Total: ₱360$/m)
  })

  it('leaves out a line whose detail is missing, without a double blank line', () => {
    const out = fillTemplate(DEFAULT, { ...base, pickup: '  ', maya: '' })
    expect(out).not.toMatch(/Pickup|Maya/)
    expect(out).not.toMatch(/\n\n\n/)
    expect(out).toMatch(/^GCash: 0917 123 4567$/m)
  })

  it('an empty {name} disappears but keeps the greeting', () => {
    const t = 'Hi po {name}! Eto po yung order niyo:\nTotal: {total}'
    expect(fillTemplate(t, { ...base, name: '' })).toBe('Hi po! Eto po yung order niyo:\nTotal: ₱360')
    expect(fillTemplate(t, { ...base, name: 'Ana' })).toBe('Hi po Ana! Eto po yung order niyo:\nTotal: ₱360')
    expect(fillTemplate('Salamat {name}, ingat!', { ...base, name: '' })).toBe('Salamat, ingat!')
  })

  it('sends unknown {tags} as written', () => {
    expect(fillTemplate('Total: {totla}\n{items}', base)).toMatch(/^Total: \{totla\}$/m)
  })

  it('drops items and total for an empty cart', () => {
    expect(fillTemplate(DEFAULT, { ...base, lines: [], total: 0 })).not.toMatch(/Total|1x/)
  })

  it('handles a template saved with Windows line endings', () => {
    expect(fillTemplate('Hi!\r\nTotal: {total}', base)).toBe('Hi!\nTotal: ₱360')
  })
})

describe('itemLine', () => {
  it('shows centavos as ₱x.50 and groups thousands', () => {
    expect(itemLine({ ...fries, quantity: 1, lineTotal: 1234.5 })).toBe('1x Flavored Fries – BBQ — ₱1,234.50')
  })
})

describe('unknownPlaceholders', () => {
  it('reports typos once each, and nothing for the default', () => {
    expect(unknownPlaceholders('{totla} {totla} {items} {nmae}')).toEqual(['totla', 'nmae'])
    expect(unknownPlaceholders(DEFAULT)).toEqual([])
  })
})
