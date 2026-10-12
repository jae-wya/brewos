import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { menuApi, errorMessage } from '../lib/api'
import { keys } from '../lib/queryKeys'
import { setAvailability, pendingAvailability } from '../lib/availabilityWrites'
import { MenuData } from '../types'

type Kind = 'item' | 'option'

// Write one item's or option's availability into the cached Menu page data.
// An option is stored once under its modifier group, so every row that shows
// it (e.g. "Large" under thirty drinks) updates together.
function withAvailability(data: MenuData, kind: Kind, id: string, value: boolean): MenuData {
  if (kind === 'item') {
    return { ...data, items: data.items.map(i => i.id === id ? { ...i, is_available: value } : i) }
  }
  return {
    ...data,
    modifiers: data.modifiers.map(m => ({
      ...m,
      modifier_options: m.modifier_options.map(o => o.id === id ? { ...o, is_available: value } : o),
    })),
  }
}

// On/off switch on the Menu page. Timing, ordering and rollback live in
// lib/availabilityWrites.ts; this hook connects them to the cache and the API.
//   * The Menu page is never refetched for a toggle, so a slow refetch can't
//     flash old values over a switch she just flipped.
//   * After a successful save, the order screen's menu is marked stale so it
//     refetches next time it opens.
//   * On failure, returns an error for the row to show.
export function useAvailabilityToggle(kind: Kind, id: string, name: string) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const key = `${kind}:${id}`

  const set = (shown: boolean, next: boolean) => {
    setError(null)
    setAvailability(key, shown, next, {
      send: v => (kind === 'item' ? menuApi.setItemAvailable(id, v) : menuApi.setOptionAvailable(id, v))
        .then(res => res.is_available),
      show: v => {
        qc.cancelQueries({ queryKey: keys.menuFull })
        qc.setQueryData<MenuData>(keys.menuFull, d => d && withAvailability(d, kind, id, v))
      },
      onSaved: () => qc.invalidateQueries({ queryKey: keys.menu }),
      onFailed: (v, err) => setError(`Couldn't turn ${v ? 'on' : 'off'} ${name}. ${errorMessage(err)}`),
    })
  }

  // The value to show: her pending tap if there is one, else the cached value.
  const on = (cached: boolean) => pendingAvailability(key) ?? cached

  return { set, on, error }
}
