# Cross-platform compatibility audit (2026-11-23)

## Scope and release safety
- Audit target: `release/standalone-railway`.
- Work branch: `compat/cross-platform-audit-20261123`.
- No production branch, deployment, database, secrets, or user data changed.

## Confirmed findings from source
1. `package.json` uses Vite `^7.3.7`, React 18, TypeScript, and declares Node `>=22 <23`.
2. `vite.config.ts` does not define an explicit legacy-browser build target or legacy-browser plugin.
3. `tsconfig.app.json` targets ES2020. This is a TypeScript checking/emission setting, not by itself a guarantee of browser compatibility.
4. `index.html` loads the app as an ES module (`type="module"`) and fetches Vazirmatn from Google Fonts; older browsers without module support cannot boot this entry point.
5. `src/main.tsx` registers a service worker only on approved production hosts. This does not itself make the app compatible with older browsers.
6. `src/App.tsx` relies on React 18 `createRoot`; any legacy support must be tested against the browser capabilities required by React and the bundled dependencies.

## Important limitation
A front-end transpilation change alone cannot make Windows 7 browsers securely connect to Cloudflare Pages and Supabase. TLS/certificate support, modern JavaScript APIs, browser engine support, and Supabase client requirements are separate constraints. Windows 7 with an obsolete browser cannot be promised support.

## Safe next implementation stages
1. Inventory browser APIs and syntax used across `src/`, especially storage, file handling, date inputs, printing, service workers, and Supabase client dependencies.
2. Choose an explicit support matrix (current Chrome/Edge/Firefox/Safari; Android/iOS; and a separately-labelled best-effort legacy tier).
3. Add a legacy build only if its required polyfills and dependencies are compatible and maintainable; do not downgrade Vite/React/Supabase blindly.
4. Build and typecheck on the compatibility branch, then deploy only a preview URL for device/browser testing.
5. Keep the current production deployment and APK untouched until the preview passes login, CRUD, uploads, printing, archive, and PWA smoke tests.

## Current result
Audit only. No application source code changed in this commit.
