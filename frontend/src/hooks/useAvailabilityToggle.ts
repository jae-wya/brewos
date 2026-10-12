import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { menuApi, errorMessage } from '../lib/api'
import { keys } from '../lib/queryKeys'
import { setAvailability, shownAvailability } from '../lib/availabilityWrites'
import { MenuData } from '../types'

type Kind = 'item' | 'option'

// Write one item's or option's availability into the cached menu.
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
//   * Every tap (and any rollback) goes into the one cached menu, which the
//     order screen reads too, so it stops offering a turned-off item or
//     add-on at once.
//   * No reload after a save: the server's value is written straight in, and
//     writing cancels any reload in flight that started before the save.
//   * On failure, returns an error for the row to show.
export function useAvailabilityToggle(kind: Kind, id: string, name: string) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const set = (shown: boolean, next: boolean) => {
    setError(null)
    setAvailability(`${kind}:${id}`, shown, next, {
      send: v => (kind === 'item' ? menuApi.setItemAvailable(id, v) : menuApi.setOptionAvailable(id, v))
        .then(res => res.is_available),
      show: v => {
        qc.cancelQueries({ queryKey: keys.menu })
        qc.setQueryData<MenuData>(keys.menu, d => d && withAvailability(d, kind, id, v))
      },
      onFailed: (v, err) => setError(`Couldn't turn ${v ? 'on' : 'off'} ${name}. ${errorMessage(err)}`),
    })
  }

  const on = (cached: boolean) => shownAvailability(kind, id, cached)

  return { set, on, error }
}
