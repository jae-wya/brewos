// Fills her Messenger payment-request template from the cart. No React and no
// imports, so it can be tested on its own.
//
// The template is her own text (Settings) with placeholders:
//   {items}   one line per cart line: "1x Spanish Latte (Iced Coffee) – Medium (M) — ₱120"
//   {total}   the cart total from the live menu, e.g. ₱255
//   {pickup}  what she typed in Pickup
//   {name}    the customer's name
//   {gcash}   her GCash number
//   {maya}    her Maya number
//
// A template line with a detail that has nothing to fill it (no pickup time,
// no Maya number) is left out of the message entirely, so optional details go
// on their own lines. {name} is different: it's decoration, usually in the
// greeting, and Messenger orders often have no name typed — so an empty
// {name} just disappears ("Hi po {name}!" -> "Hi po!") instead of taking the
// greeting with it. Anything in braces that isn't a placeholder is left as
// written.

export const PLACEHOLDERS = ['items', 'total', 'pickup', 'name', 'gcash', 'maya'] as const
type Placeholder = typeof PLACEHOLDERS[number]

export interface ComposerLine {
  quantity: number
  name: string
  category: string | null
  // True when the same name is on the menu in more than one category (Hot
  // and Iced Spanish Latte): only then does the customer need the category.
  showCategory: boolean
  modifiers: string[]
  lineTotal: number
}

export interface ComposerInput {
  lines: ComposerLine[]
  total: number
  pickup: string
  name: string
  gcash: string
  maya: string
}

// ₱120, ₱4,753.50 — never ₱4,753.5.
export const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

export function itemLine(l: ComposerLine): string {
  const category = l.showCategory && l.category ? ` (${l.category})` : ''
  const mods = l.modifiers.length ? ` – ${l.modifiers.join(', ')}` : ''
  return `${l.quantity}x ${l.name}${category}${mods} — ${peso(l.lineTotal)}`
}

const PLACEHOLDER_RE = /\{(\w+)\}/g
const isPlaceholder = (p: string): p is Placeholder => (PLACEHOLDERS as readonly string[]).includes(p)

export function fillTemplate(template: string, input: ComposerInput): string {
  const values: Record<Placeholder, string> = {
    items: input.lines.map(itemLine).join('\n'),
    total: input.lines.length ? peso(input.total) : '',
    pickup: input.pickup.trim(),
    name: input.name.trim(),
    gcash: input.gcash.trim(),
    maya: input.maya.trim(),
  }
  const kept: string[] = []
  for (const line of template.replace(/\r\n/g, '\n').split('\n')) {
    const used = [...line.matchAll(PLACEHOLDER_RE)].map(m => m[1]).filter(isPlaceholder)
    if (used.some(p => p !== 'name' && !values[p])) continue // a detail she didn't give: drop the whole line
    let filled = line.replace(PLACEHOLDER_RE, (whole, p) => isPlaceholder(p) ? values[p] : whole)
    if (used.includes('name') && !values.name) {
      filled = filled.replace(/ +([!,.?])/g, '$1').replace(/ {2,}/g, ' ') // "Hi po !" -> "Hi po!"
    }
    kept.push(filled)
  }
  // Dropping lines can leave stacked blank lines; keep at most one.
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Braced words that aren't placeholders, for the Settings page to warn about
// ("{totla}" would otherwise be sent to a customer as-is).
export function unknownPlaceholders(template: string): string[] {
  const found = [...template.matchAll(PLACEHOLDER_RE)].map(m => m[1]).filter(p => !isPlaceholder(p))
  return [...new Set(found)]
}
