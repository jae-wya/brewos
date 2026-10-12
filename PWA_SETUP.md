# BrewOS PWA — setup

## 1. Install the plugin

```bash
npm install -D vite-plugin-pwa
```

## 2. Drop in the files

| File | Where it goes |
|---|---|
| `vite.config.ts` | replaces your existing one |
| `index.html` | replaces your existing one |
| `InstallPrompt.tsx` | `src/components/InstallPrompt.tsx` |
| everything in `brewos-icons/` | `public/` (flat, not in a subfolder) |

The icons must sit directly in `public/` — the manifest paths are `/icon-192.png`,
not `/icons/icon-192.png`.

## 3. Add the types reference

In `src/vite-env.d.ts`:

```ts
/// <reference types="vite-plugin-pwa/react" />
```

Without this, TypeScript will not resolve `virtual:pwa-register/react`.

## 4. Mount the component

In `App.tsx`, once, outside your router so it shows on every page:

```tsx
import InstallPrompt from './components/InstallPrompt'

// ...inside the top-level layout, after <Routes />
<InstallPrompt />
```

## 5. Build and test

```bash
npm run build && npm run preview
```

The service worker only runs in a production build — `npm run dev` will not
show the install prompt. That is deliberate (`devOptions.enabled: false`);
a live service worker during development caches your old code and makes
changes look like they did not apply.

---

## What this gives you

- Installs to the home screen on Android (custom in-app button)
- Install instructions on iOS, which has no programmatic install
- Opens with no browser chrome — looks like a native app
- App shell cached, so repeat opens are instant
- An "Update ready" toast when you deploy a new version

## What it deliberately does not do

**No offline order entry.** API calls are never cached. If the connection drops,
the app says so rather than accepting an order into a local queue that might
never sync. For a single-operator café on shop wifi this is the right trade —
a silently lost order is far worse than a visible error.

## Verifying it worked

On the deployed Vercel URL, in Chrome DevTools:

- **Application → Manifest** — no errors, icons all resolve
- **Application → Service Workers** — one worker, activated and running
- **Lighthouse → Progressive Web App** — should pass installability

On an actual Android phone, open the Vercel URL in Chrome. The install bar
appears at the bottom. Install it, then open from the home screen — no address
bar means it worked.

## Two things to know

**The install prompt is one-shot.** Once `prompt()` is called, the captured
event is spent. Chrome re-fires `beforeinstallprompt` on a later visit if the
user did not install, but not within the same page load.

**Dismissal is remembered.** "Not now" writes to `localStorage` and the prompt
stays hidden on that device. To test repeatedly, clear
`brewos:install-dismissed` or use a fresh incognito window.

## Known iOS limits

Safari has no `beforeinstallprompt`, so install is always a manual Share →
Add to Home Screen. Installed iOS PWAs can also have their storage evicted
after extended disuse. Neither matters for the current build since nothing is
stored locally — but it does matter if offline support is ever added later.
