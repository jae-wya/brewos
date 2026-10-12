import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Chrome fires this before showing its own install banner. We capture the
 * event, suppress the default banner, and surface our own button instead —
 * so the install moment happens inside the app, on our terms.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'brewos:install-dismissed'

// Above the bottom nav (about 57px tall, zIndex 100), like the Menu page's
// undo bar; just under that bar (105) and the item sheet (110). The Tailwind
// bottom-4/z-50 it had put the bar's lower half behind the nav.
const ABOVE_NAV = { bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))', zIndex: 104 }
// .btn-fire / .btn-ghost are colours only; .btn gives padding, shape and
// height. Without it the buttons rendered 23px tall with no padding.
const TOUCH = { minHeight: 'var(--touch)' }
// .heat-border paints its gradient over the whole box; it reads as a glowing
// edge only when the content has its own background (as on the queue cards).
// Without this inner box the bar was orange all over and the label unreadable.
const HEAT_INNER = { background: 'var(--s1)', borderRadius: 'var(--r)' }
// .label's --t3 is about 3.3:1 on --s1, too faint for 10px text on a bar she
// glances at; --t2 is about 6.3:1.
const LABEL = { color: 'var(--t2)' }

// This component is mounted at the root, so a throw here blanks the whole
// app. localStorage throws when storage is blocked (some private modes).
function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [dismissed, setDismissed] = useState(wasDismissed)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    // Already installed and running standalone — nothing to prompt.
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari exposes this non-standard flag instead of display-mode
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return

    // iOS has no beforeinstallprompt — install is a manual Share-sheet action,
    // so we detect it and show instructions rather than a dead button.
    const ua = window.navigator.userAgent
    const iOSDevice = /iPad|iPhone|iPod/.test(ua) ||
      // iPadOS 13+ reports as Mac; the touch-point check disambiguates
      (ua.includes('Mac') && 'ontouchend' in document)
    if (iOSDevice) {
      setIsIOS(true)
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    const onInstalled = () => setDeferred(null)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    // The event can only be used once — drop it either way.
    setDeferred(null)
    if (outcome === 'dismissed') dismiss()
  }

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* hidden for this visit only */ }
    setDismissed(true)
    setShowIOSHelp(false)
  }

  // --- Update available ------------------------------------------------
  if (needRefresh) {
    return (
      <div className="fixed left-4 right-4 heat-border" style={ABOVE_NAV}>
      <div className="p-4 flex items-center gap-3" style={HEAT_INNER}>
        <div className="flex-1">
          <p className="label" style={LABEL}>Update ready</p>
          <p className="text-sm opacity-80">A new version of BrewOS is available.</p>
        </div>
        <button className="btn btn-ghost" style={TOUCH} onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button className="btn btn-fire" style={TOUCH} onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      </div>
      </div>
    )
  }

  if (dismissed) return null

  // --- iOS: manual instructions ----------------------------------------
  if (isIOS) {
    return (
      <div className="fixed left-4 right-4 panel p-4" style={ABOVE_NAV}>
        {showIOSHelp ? (
          <>
            <p className="label mb-2" style={LABEL}>Install BrewOS</p>
            <ol className="text-sm opacity-80 space-y-1 list-decimal list-inside">
              <li>Tap the Share button in Safari</li>
              <li>Scroll down and tap “Add to Home Screen”</li>
              <li>Tap “Add”</li>
            </ol>
            <button className="btn btn-ghost mt-3 w-full" style={TOUCH} onClick={dismiss}>
              Got it
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="label" style={LABEL}>Install BrewOS</p>
              <p className="text-sm opacity-80">Add it to your home screen.</p>
            </div>
            <button className="btn btn-ghost" style={TOUCH} onClick={dismiss}>
              Not now
            </button>
            <button className="btn btn-fire" style={TOUCH} onClick={() => setShowIOSHelp(true)}>
              How
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Android / desktop Chrome ----------------------------------------
  if (!deferred) return null

  return (
    <div className="fixed left-4 right-4 heat-border" style={ABOVE_NAV}>
    <div className="p-4 flex items-center gap-3" style={HEAT_INNER}>
      <div className="flex-1">
        <p className="label" style={LABEL}>Install BrewOS</p>
        <p className="text-sm opacity-80">
          Open it like an app, straight from your home screen.
        </p>
      </div>
      <button className="btn btn-ghost" style={TOUCH} onClick={dismiss}>
        Not now
      </button>
      <button className="btn btn-fire" style={TOUCH} onClick={install}>
        Install
      </button>
    </div>
    </div>
  )
}
