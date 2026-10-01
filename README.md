# FieldSync PWA

FieldSync is an installable, offline-first app for ASHA workers. Patient and visit records, queue operations, sync history, and cached care summaries are stored in the password-unlocked encrypted IndexedDB vault.

## Run the production PWA locally

The service worker is disabled in Vite development mode to avoid caching hot-reload modules. Build and preview the production app to exercise installation and offline navigation:

```sh
npm run build
npm run preview -- --host 0.0.0.0
```

Open the preview on `localhost` or an HTTPS origin. The generated manifest uses the 192px and 512px PNG icons. Workbox precaches the app shell and static assets, then falls back to the cached `index.html` for app routes while offline. API responses are excluded from Workbox caching and carry `Cache-Control: no-store`.

## Offline sync behavior

- Sign in as an approved ASHA worker while online once to create the local vault. Offline sign-in unlocks it with the same account password.
- The ASHA header shows online, syncing, or offline state and local pending, synced, failed, and conflict totals.
- Patient and visit edits send changed fields with their original base values. Repeated edits coalesce while an operation has not started; after the first attempt, the operation payload and ID stay fixed for safe retries.
- Writes are serialized across tabs where the browser supports Web Locks. Retry delays grow after network and server errors. Create, update, and archive operations retain their client operation IDs for idempotent replay.
- Static shell files and the small app icons are cached; clinical API responses are never cached and local clinical data is encrypted at rest.

## Manual offline check

1. Build and preview the client, sign in online as an approved ASHA worker, then install FieldSync from the browser.
2. Open a patient record and create a demo patient or visit. Confirm the queue totals update and the operation syncs once while online.
3. Turn on airplane mode, reopen a patient route, sign in with the same account password if prompted, and create or edit a demo record. Confirm the app shell and local data remain available and the pending total increases.
4. Restore connectivity and confirm the queued operation syncs and leaves the pending count. Use the sync details page to inspect any failed operation or conflict.

Use non-production demo records for this check.
