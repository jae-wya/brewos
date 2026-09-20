import { useState, useEffect } from 'react'
import { onWakeChange } from '../lib/api'

export function useWakeState() {
  const [waking, setWaking] = useState(false)
  useEffect(() => onWakeChange(setWaking), [])
  return waking
}
