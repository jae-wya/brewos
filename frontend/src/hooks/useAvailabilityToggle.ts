import { useState } from 'react'
import { useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query'
import { menuApi, errorMessage } from '../lib/api'
import { keys } from '../lib/queryKeys'
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

// On/off switch on the Menu page.
//   * Flips instantly in the cache, then sends the request.
//   * Sends the target value, not "toggle", so a retry can't undo itself.
//   * While one request for this item/option is in flight, every switch for
//     it is disabled — no second, conflicting write can be queued.
//   * On failure: puts back ONLY this item/option (not a whole-menu snapshot,
//     which would also undo a different switch she flipped meanwhile) and
//     returns an error for the row to show.
//   * On success: writes the server's value, and marks the order screen's
//     menu stale so it refetches next time it opens. The Menu page itself is
//     not refetched, so a slow refetch can't flash old values over a
//     still-pending switch.
export function useAvailabilityToggle(kind: Kind, id: string, name: string) {
  const qc = useQueryClient()
  const mutationKey = ['availability', kind, id]
  const busy = useIsMutating({ mutationKey }) > 0
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationKey,
    mutationFn: (next: boolean) =>
      kind === 'item' ? menuApi.setItemAvailable(id, next) : menuApi.setOptionAvailable(id, next),
    onMutate: async (next: boolean) => {
      setError(null)
      await qc.cancelQueries({ queryKey: keys.menuFull })
      qc.setQueryData<MenuData>(keys.menuFull, d => d && withAvailability(d, kind, id, next))
    },
    onSuccess: (res) => {
      qc.setQueryData<MenuData>(keys.menuFull, d => d && withAvailability(d, kind, id, res.is_available))
      qc.invalidateQueries({ queryKey: keys.menu })
    },
    onError: (err, next) => {
      qc.setQueryData<MenuData>(keys.menuFull, d => d && withAvailability(d, kind, id, !next))
      setError(`Couldn't turn ${next ? 'on' : 'off'} ${name}. ${errorMessage(err)}`)
    },
  })

  return {
    set: (next: boolean) => { if (!busy) mutation.mutate(next) },
    busy,
    error,
  }
}
