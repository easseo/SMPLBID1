# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Server (`cd server`)
```bash
npm install
npx prisma migrate dev   # first run only — creates dev.db
npm run seed             # wipes and repopulates demo data + uploads/
npm run dev              # tsx watch on :4000
npm run build            # tsc compile to dist/
```

### Client (`cd client`)
```bash
npm install
npm run dev              # Vite on :5173
npm run build            # tsc + vite build
npm run lint             # oxlint
```

No test suite is configured yet (see TASK-001). The client Vite dev server proxies `/api`, `/uploads`, and `/socket.io` to `:4000`, so both servers must run simultaneously.

---

## Environment

`server/.env` is committed with safe dev defaults. Required vars:
- `DATABASE_URL` — SQLite path (e.g. `file:./dev.db`)
- `JWT_SECRET` — must be set or the server throws on startup
- `PORT` — defaults to 4000
- `CLIENT_ORIGIN` — defaults to `http://localhost:5173`

---

## Architecture

### Monorepo layout
Two independent npm workspaces: `server/` and `client/`. No shared package; types are duplicated or re-declared between them.

### Server
- **Entry** `server/src/index.ts` — creates Express app + `http.Server` + Socket.IO Server, registers middleware, mounts routes, runs a `setInterval` every 5 s to call `sweepExpiredAuctions`.
- **Auth** `server/src/lib/auth.ts` — JWT in a `httpOnly` cookie (`smplbid_token`), 7-day expiry, HS256 pinned. `attachUser` middleware runs globally and sets `req.userId`. `requireAuth` is a guard for protected routes.
- **Socket identity** `server/src/index.ts:110–116` — user identity for Socket.IO is derived from the auth cookie on the WebSocket handshake, never from a client-supplied argument, to prevent room-hijacking.
- **Auction engine** `server/src/lib/auctionEngine.ts` — `finalizeAuction` sets `Sample.status = "ended"`, assigns winner, mints a `Certificate` (SHA-256 content hash + random `SMPL-XXXXXX` code), sends notifications, emits `auction:ended` + global `activity`. `sweepExpiredAuctions` finds all live samples past `endTime` and finalizes them.
- **Bid route** `server/src/routes/bids.ts` — enforces minimum increment, anti-snipe extension (resets `endTime` to `now + antiSnipeSeconds` when a bid lands within that window), triggers `finalizeAuction` immediately on buy-now threshold.
- **Real-time rooms** `server/src/lib/io.ts` — `sampleRoom(id)` for per-auction events, `userRoom(id)` for private notifications.
- **Audio protection** — preview endpoint streams full file (no Range support yet — TASK-002). Full audio/stems/MIDI are gated behind seller-or-winner checks. Extensions are assigned server-side from validated MIME type; `originalname` is never used.
- **Prisma models**: `User`, `Sample`, `Bid`, `Notification`, `Certificate`. All IDs are CUIDs.

### Client
- **Routing** — React Router v7. `RequireAuth` component wraps protected pages.
- **Contexts** (`client/src/context/`):
  - `AuthContext` — current user state, login/logout, fetched on mount.
  - `ToastContext` — queues transient toast messages.
  - `NotificationContext` — fetches notification list on login, then subscribes to the `notification` socket event and also fires a toast.
- **Socket** `client/src/lib/socket.ts` — singleton `socket.io-client` instance. Components join/leave sample rooms on mount/unmount.
- **API client** `client/src/lib/api.ts` — thin wrapper around `fetch` targeting `/api/*` (proxied by Vite).
- **AudioPlayer** — uses Web Audio API to mix a faint watermark tone into preview playback.
- **Avatar** — generated from `User.avatarSeed` (a CUID) with no external service.

### Key data flow: placing a bid
1. Client POSTs to `POST /api/samples/:id/bids`
2. Server validates auth, auction liveness, minimum increment, self-bid guard
3. Server writes `Bid`, updates `Sample.currentPriceCents` and possibly `endTime`
4. Server emits `bid:new` to the sample room and `activity` globally
5. Server notifies the previously-highest bidder (writes `Notification` row + emits `notification` to their private room)
6. If buy-now threshold met, `finalizeAuction` runs immediately

### Seeding
`server/src/seed.ts` wipes all tables and `uploads/`, creates demo users (all password `password123`: `kaidenmakes`, `luna_waves`, `trapgodhenry`, `sundriedsamples`, `mira_beats`, `dj_ohmega`), generates synthetic WAV audio via `genTone.ts`, and inserts auctions with staggered end times.

---

## Working methodology

### 1. Source of truth

`TASKS.md` is the source of truth for the build plan. `SPEC.md` documents the current as-built system.

Before starting work:
- Read the relevant task in `TASKS.md`
- Check `SPEC.md` when product/spec reasoning is needed
- Run `git status`

After finishing any task, update its entry in `TASKS.md` in the same turn.

Add a `**Status:** ...` line directly under the task heading. Use:
- `DONE (commit <sha>)`
- `DONE (local, uncommitted)`
- `PARTIAL`
- `OBSOLETE`
- `NEEDS FOLLOW-UP`
- `BLOCKED`

Include briefly: files changed, tests run, commit/local status, deviations, what remains.

Do not delete or rewrite the original `What to do` / `Definition of Done` lines.

If repo reality and `TASKS.md` disagree, update `TASKS.md` immediately.

---

### 2. Parallel work safety

Multiple agents may work in parallel.

Before editing:
- Run `git status`
- Avoid files already being edited by another agent
- Prefer new helper files when possible

High-conflict files:
- `TASKS.md`
- `SPEC.md`
- `server/src/lib/auctionEngine.ts`
- `server/src/routes/bids.ts`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/`
- `client/src/context/AuthContext.tsx`

If conflict risk exists, state it before editing.

When multiple agents are used:
- Keep each sub-agent scope narrow
- Avoid assigning the same file to multiple agents unless explicitly necessary
- If the same file must be touched, the orchestrator controls the final integration
- Do not merge sub-agent work blindly — review actual diffs before accepting

---

### 3. Model recommendation

Before meaningful implementation work, recommend a model once and stop for user approval/switch.

Format: `Model recommendation: <Sonnet|Opus> — <one-line reason>. Switch with /model <name>, or say "go".`

Use **Sonnet** for:
- Normal implementation (routes, components, tests)
- Isolated services or helpers
- Small refactors
- Documentation updates
- TypeScript fixes

Use **Opus** for:
- Auction engine or bid logic changes
- Auth flow or JWT/security changes
- Prisma schema migrations
- Socket.IO architecture decisions
- Multi-agent orchestration
- Final QA ownership after sub-agents
- Unclear spec/code/TASKS conflicts
- Any change that touches both server business logic and the database schema together

For read-only investigation or tiny fixes, no model recommendation is needed.

Never claim you switched models yourself. The user controls `/model`.

---

### 4. Opus orchestrator + sub-agents

Use the full orchestrator workflow whenever the user explicitly or implicitly asks to use agents, sub-agents, parallel agents, or split work between agents.

#### 4.1 Opus orchestrator responsibilities
- Read `TASKS.md` and understand dependencies
- Split work into focused sub-tasks with narrow file scopes
- Avoid file conflicts
- Review all sub-agent outputs (read actual diffs, not summaries)
- Perform scenario-level QA for user-facing flows
- Inspect test quality, not only test count
- Send fixes back when needed
- Update `TASKS.md`
- Produce the final summary

Sub-agent work is considered unverified until Opus has reviewed the actual diff, checked behavior, and inspected tests.

#### 4.2 Sub-agent roles

**Sonnet** for implementation:
- Routes, services, components
- Tests
- TypeScript fixes
- Focused refactors

**Haiku** for lightweight support only:
- grep/search, file inventory
- Stale wording checks
- Simple summaries

Do not use Haiku for: auction engine, auth, migrations, Socket.IO architecture, security logic, or final QA ownership.

#### 4.3 Sub-agent prompts must include
- Task ID and exact goal
- Allowed files and files to avoid
- Tests to run
- Known risks
- Expected output
- Reminder to report any `TASKS.md` impact

#### 4.4 File conflict rules
For high-conflict files, Opus should either assign to only one sub-agent, or ask sub-agents to produce proposed patches only, then integrate manually.

---

### 5. QA after sub-agents

The orchestrator must not trust sub-agent summaries, green tests, or TypeScript compilation alone.

#### 5.1 Mandatory technical QA
- Scope was completed
- No wrong files were edited
- Implementation matches `TASKS.md` and `SPEC.md`
- Old flows were not reintroduced
- Tests were added or updated
- `npx tsc --noEmit` passes when TypeScript changed
- Migrations are idempotent when schema changed
- `TASKS.md` was updated

#### 5.2 Mandatory qualitative QA

For every sub-agent result, read the changed files and verify:
1. The implementation actually does what was requested
2. Behavior matches `TASKS.md` and `SPEC.md`
3. Permission/access gates are correct (e.g. seller-only, winner-only, requireAuth)
4. State transitions are correct (auction status: live → ended only once)
5. Socket.IO events fire to the correct rooms
6. Error states and empty states are handled
7. No forbidden writes were introduced (e.g. mutating `Sample.status` outside `finalizeAuction`)

#### 5.3 Scenario QA for SMPLbid flows

For any user-facing, auction, or auth flow, verify at minimum:

- **Bid placement** — happy path, minimum increment rejection, self-bid rejection, ended auction rejection, anti-snipe extension, buy-now trigger
- **Auction finalization** — winner assigned, certificate created, winner/seller/loser notifications sent, `auction:ended` emitted
- **File upload** — valid upload accepted, invalid MIME rejected, duration out of range rejected, magic-byte check on ZIP/image, cleanup on partial failure
- **Auth** — login sets cookie, logout clears cookie, `requireAuth` returns 401 on missing token
- **Access control** — full audio gated to seller+winner, vault/dashboard gated to auth user, certificate page public

#### 5.4 Test quality review
Tests added by sub-agents must:
- Assert behavior, not just that a function returns something
- Cover negative/permission cases
- Cover empty states (e.g. auction with no bids finalized → no winner, no certificate, `unsold` notification)
- Would fail if the wrong handler was wired up
- Would fail if old behavior was accidentally restored

#### 5.5 Diff review requirement
Before accepting sub-agent work, review the actual diff and confirm:
- What files changed and why
- No unintended edits to high-conflict files
- No duplicated logic or stale handlers
- Implementation is consistent with existing architecture
- Security-sensitive paths (auth, file upload, bid validation) have not been weakened

#### 5.6 Forbidden QA shortcuts
Work is not done only because:
- Sub-agent summary sounds correct
- Tests pass
- TypeScript compiles
- Diff looks small
- Implementation "looks reasonable"

These are useful signals but do not replace behavioral verification.

#### 5.7 Required QA report before commit
Include: files reviewed manually, scenarios checked, tests run, TypeScript result, permission checks verified, spec compliance confirmed, remaining risks.

Distinguish between "tests passed", "I manually reviewed the implementation", and "I verified the actual behavior."

---

### 6. Finish checklist

Before final response:
- Run relevant tests
- Run `npx tsc --noEmit` if TypeScript changed
- Run `npm run lint` in `client/` if client code changed
- Verify migrations if schema changed
- Update `TASKS.md`
- Run `git status`
- Review actual diffs/code changed by sub-agents
- Verify main user-facing scenarios manually or through focused tests
- Inspect test quality, not only test count
- Verify permission gates and access control
- Verify implementation matches `TASKS.md` and `SPEC.md`
- Verify no old flows were reintroduced

Final response must report:
- Task IDs completed
- Files changed and manually reviewed
- Scenarios checked
- Tests run and TypeScript result
- Commit SHA or local/uncommitted status
- Remaining follow-ups or risks

If sub-agents were used, also report: which models/sub-agents were used, what each did, what the orchestrator independently verified, any fixes sent back after QA.
