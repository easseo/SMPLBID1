# TASKS.md — SMPLbid Build Plan

This is the source of truth for all planned work on SMPLbid.

Status values: `TODO` · `IN PROGRESS` · `DONE (commit <sha>)` · `DONE (local, uncommitted)` · `PARTIAL` · `OBSOLETE` · `NEEDS FOLLOW-UP` · `BLOCKED`

---

## TASK-001: Add automated test suite

**Status:** DONE (local, uncommitted)

**Result:** Vitest added to `server/` with 35 passing tests across 3 files. Tests use a real SQLite test DB (`server/prisma/test.db`, gitignored) and a real Express handler via supertest — no over-mocking. Coverage:
- `auth.test.ts` (6 tests) — round-trip, wrong-secret rejection, `alg:none` attack rejection, expired token, malformed input, HS256-only signing check.
- `auctionEngine.test.ts` (12 tests) — happy path (winner, certificate, won/sold/lost notifications), no-bid branch (unsold notification, no cert, no wrong notifications), idempotency (already-ended is a no-op).
- `bids.test.ts` (17 tests) — 401 unauthenticated, happy path (201 + DB row + `currentPriceCents` update), self-bid 403, ended/past-endTime 400, minimum increment (too low + exactly-at-minimum), already-top-bidder 400, anti-snipe extension (inside + outside window), buy-now finalization (status/winner/cert/notification/outbid+lost chain), 404 unknown sample.

**Files:** `server/package.json` (added `vitest`, `@vitest/coverage-v8`, `supertest`, `@types/supertest` devDeps + `test`/`test:watch` scripts), `server/vitest.config.ts`, `server/.gitignore`, `server/src/test/{globalSetup,setup,fixtures,testApp,auth.test,auctionEngine.test,bids.test}.ts`. No production source files were touched. Orchestrator cleanup: fixed `DATABASE_URL` from `file:./prisma/test.db` (which resolved to `server/prisma/prisma/test.db`) to `file:./test.db` so the DB lands at `server/prisma/test.db` where the gitignore expects it.

**Tests:** `npm test` in `server/` → 35/35 passing. `npx tsc --noEmit` in `server/` → clean.

**Deviations from spec:** Client tests (contexts, AudioPlayer) not added — server-only scope was prioritized per the task's "priority" section, client tests remain a follow-up.

**Follow-ups:** Client tests still pending. Consider tests for `sweepExpiredAuctions` multi-sample isolation once TASK-007 lands, and `attachUser`/`requireAuth` middleware edge cases.

### What to do

### What to do
Add [Vitest](https://vitest.dev/) to both `server/` and `client/`. No tests currently exist.

Server tests (priority):
- `auctionEngine.ts` — `finalizeAuction`: winner selection, certificate creation, notification dispatch, no-bid branch
- `routes/bids.ts` — minimum increment enforcement, self-bid guard, anti-snipe extension, buy-now trigger
- `lib/auth.ts` — token sign/verify, algorithm-pinning rejection

Client tests (secondary):
- Context logic (`AuthContext`, `NotificationContext`) using React Testing Library
- `AudioPlayer` watermark mixing path

### Definition of Done
- `npm test` passes in `server/`
- At least the bid route and auction engine are covered with meaningful assertions (not just happy path)
- Negative cases covered: invalid bid amount, self-bid, ended auction, insufficient increment

---

## TASK-002: HTTP Range request support on preview endpoint

**Status:** DONE (local, uncommitted)

**Result:** Range support added to `GET /api/samples/:id/preview` and `GET /api/samples/:id/full` via a shared `serveWithRange` helper. Behavior end-to-end verified with `curl` against a real dev server (seeded data): no `Range` → `200` + full stream + `Accept-Ranges: bytes`; `bytes=0-1023` → `206` + `Content-Range: bytes 0-1023/<size>` + `Content-Length: 1024`; requested 1000 bytes returned exactly 1000 bytes (off-by-one correct); suffix form `bytes=-500` and open-ended `bytes=1024-` both return `206`; invalid (`bytes=abc`, `bytes=99999999-99999999`) → `416` with `Content-Range: bytes */<size>`. Auth gate on `/full` preserved — `curl -r 0-1023 /full` without cookie returns `401`, not `206`.

**Files:** `server/src/lib/rangeStream.ts` (new), `server/src/routes/samples.ts` (preview + full endpoints now delegate to `serveWithRange`). No changes to `/stems` or `/midi` (ZIP downloads don't need seeking).

**Tests:** No unit tests added yet — behavior verified via manual `curl`. `npx tsc --noEmit` in `server/` → clean.

**Deviations from spec:** None.

**Follow-ups:** Add automated tests for `serveWithRange` covering all forms (no-Range, `bytes=A-B`, `bytes=A-`, `bytes=-N`, `bytes=-` degenerate, malformed, unsatisfiable, `end >= fileSize` clamping).

### What to do

### What to do
`GET /api/samples/:id/preview` currently pipes the full file without handling the `Range` header. Audio players (including `<audio>` elements and the Web Audio API) need Range support for seeking and resumable buffering.

Changes required in `server/src/routes/samples.ts`:
- Parse `Range` header on `GET /:id/preview`
- Respond with `206 Partial Content` and correct `Content-Range` / `Content-Length` headers when a range is requested
- Fall back to `200` with full stream when no `Range` header is present

The same fix should be applied to `GET /:id/full` for consistency (winners/sellers downloading large WAVs).

### Definition of Done
- `curl -r 0-1023` against the preview endpoint returns `206` with correct headers
- AudioPlayer can seek without errors in the browser

---

## TASK-003: Pagination on sample listing endpoint

**Status:** DONE (local, uncommitted)

**Result:** `GET /api/samples` now accepts `?page=<n>&limit=<n>` with defaults `page=1`, `limit=20`, cap `limit=100`. Response shape: `{ samples, page, limit, total, hasMore }`. Verified end-to-end against seeded data (15 total samples): `page=1&limit=2` → 2 samples, total=15, hasMore=true; `page=3&limit=2` → 2 samples, hasMore=true (correct); `limit=500` → capped to `limit=100`; `?status=live&page=1&limit=100` → 3 samples all with `status="live"` (status filter + pagination compose correctly); `page=0`, `page=-1`, `page=1.5`, `page=abc` all return `400`. `count` + `findMany` run in parallel via `Promise.all` for efficiency.

Client updates: `PaginatedSamples` type added to `client/src/lib/types.ts`. `Arena.tsx` loads page 1 on mount and shows a snap-aligned "Load more" button at the end of the reel; new pages are merged with dedup-by-id and re-sorted by `endTime`. All existing scroll/observer/wheel/settle logic in `Arena.tsx` is unchanged. `Home.tsx` switched from `?limit=6` (dropped the old client-side `.slice(0,3)` since the server now bounds the response).

Socket.IO `activity` handler still calls `refreshSample(id)` on live bids; for samples not in the currently loaded pages, the `prev.map(...)` call safely no-ops (unchanged behavior).

**Files:** `server/src/routes/samples.ts` (pagination on `GET /`), `client/src/lib/types.ts` (added `PaginatedSamples`), `client/src/pages/Arena.tsx` (Load more), `client/src/pages/Home.tsx` (uses new shape).

**Tests:** `npx tsc --noEmit` clean on both `server/` and `client/`. `npm run lint` in `client/` — 6 warnings, all pre-existing (none introduced by this change).

**Deviations from spec:** None.

**Follow-ups:** Home hero badge (`{samples.length} active auctions`) now reflects the loaded page-1 count (≤6) rather than the true total — same behavior as before functionally, but if the true total should be shown, expose it via `total` from the response. Also: genre filter in Arena still only filters loaded pages (inherent to client-side filtering over pagination).

### What to do

### What to do
`GET /api/samples` currently fetches all rows in a single query with no limit. This will degrade as auctions accumulate.

Add cursor-based or offset pagination:
- Accept `?page=N&limit=N` (or `?cursor=<id>`) query params on `GET /api/samples`
- Default `limit=20`, max `limit=100`
- Return a `total` or `nextCursor` field alongside `samples`
- Update the client `Home` page to load more samples (infinite scroll or "Load more" button)

### Definition of Done
- `GET /api/samples?limit=10` returns at most 10 samples
- Client displays paginated results without breaking the live-bid Socket.IO updates for visible samples

---

## TASK-004: Enable TypeScript strict mode

**Status:** TODO

### What to do
Neither `server/tsconfig.json` nor `client/tsconfig.app.json` currently enable `"strict": true`. This allows implicit `any`, non-null assertion omissions, and loose index access.

- Enable `"strict": true` in both tsconfigs
- Fix resulting type errors (particularly `serializeSample(sample: any, ...)` in `samples.ts` and any loose typings in client contexts)
- Confirm `npx tsc --noEmit` passes in both packages after fixes

### Definition of Done
- Both packages compile cleanly with `strict: true`
- No `@ts-ignore` suppressions added to paper over errors

---

## TASK-005: Persist recent activity feed

**Status:** TODO

### What to do
The global activity feed (bid/sold events shown on the Home page) is currently Socket.IO-only. Users who load the page mid-session see no history.

Options (pick one):
1. **In-memory ring buffer on the server** — keep the last N (e.g. 50) activity events in a module-level array; expose `GET /api/activity` returning them; client fetches on mount then subscribes to live `activity` events.
2. **Persist to DB** — add an `Activity` Prisma model; write on each bid/finalization; expose paginated `GET /api/activity`.

Option 1 is simpler and appropriate for the current scale.

### Definition of Done
- Page load shows recent activity even with no live bids happening
- Socket.IO live updates still append in real time
- Memory footprint bounded (ring buffer capped at N events)

---

## TASK-006: Seller cannot bid on own sample — enforce on client

**Status:** TODO

### What to do
`POST /api/samples/:id/bids` already rejects self-bids server-side (403). However, the client currently shows the bid form to the seller, who only discovers the restriction after submitting.

In `client/src/pages/SampleDetail.tsx` (or wherever the bid form is rendered):
- If `sample.seller.id === currentUser.id`, hide the bid form and show a "You listed this sample" message instead

### Definition of Done
- Seller visiting their own auction sees no bid input
- The server-side guard remains in place (defense in depth)

---

## TASK-007: Graceful auction sweep error isolation

**Status:** TODO

### What to do
`sweepExpiredAuctions()` runs in a `setInterval` every 5 s. If one sample's `finalizeAuction()` throws (e.g. DB constraint), the error is currently caught at the outer `.catch()` and logged, but the loop does not skip to the next sample — the entire sweep batch fails after the first error.

In `server/src/lib/auctionEngine.ts`, wrap each `finalizeAuction` call in a per-sample try/catch so one bad row doesn't block the rest of the sweep.

### Definition of Done
- A DB error on sample A does not prevent sample B from being finalized in the same sweep pass
- Error is still logged with the sample ID for debugging

---
