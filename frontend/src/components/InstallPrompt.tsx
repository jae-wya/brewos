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

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1'
  )

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
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
    setShowIOSHelp(false)
  }

  // --- Update available ------------------------------------------------
  if (needRefresh) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 panel heat-border p-4 flex items-center gap-3">
        <div className="flex-1">
          <p className="label">Update ready</p>
          <p className="text-sm opacity-80">A new version of BrewOS is available.</p>
        </div>
        <button className="btn-ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
        <button className="btn-fire" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
      </div>
    )
  }

  if (dismissed) return null

  // --- iOS: manual instructions ----------------------------------------
  if (isIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 panel p-4">
        {showIOSHelp ? (
          <>
            <p className="label mb-2">Install BrewOS</p>
            <ol className="text-sm opacity-80 space-y-1 list-decimal list-inside">
              <li>Tap the Share button in Safari</li>
              <li>Scroll down and tap “Add to Home Screen”</li>
              <li>Tap “Add”</li>
            </ol>
            <button className="btn-ghost mt-3 w-full" onClick={dismiss}>
              Got it
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="label">Install BrewOS</p>
              <p className="text-sm opacity-80">Add it to your home screen.</p>
            </div>
            <button className="btn-ghost" onClick={dismiss}>
              Not now
            </button>
            <button className="btn-fire" onClick={() => setShowIOSHelp(true)}>
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
    <div className="fixed bottom-4 left-4 right-4 z-50 panel heat-border p-4 flex items-center gap-3">
      <div className="flex-1">
        <p className="label">Install BrewOS</p>
        <p className="text-sm opacity-80">
          Open it like an app, straight from your home screen.
        </p>
      </div>
      <button className="btn-ghost" onClick={dismiss}>
        Not now
      </button>
      <button className="btn-fire" onClick={install}>
        Install
      </button>
    </div>
  )
}
