# SPEC.md — SMPLbid Current System Specification

This document describes the current (as-built) state of SMPLbid. It is the baseline that all future improvements are layered onto.

---

## Product overview

SMPLbid is a real-time auction marketplace for exclusive, one-of-one audio samples. Producers bid in live auctions; the winner receives a verifiable certificate of ownership plus the full audio file. Each sample is permanently removed from the marketplace after sale.

---

## Stack

| Layer | Technology |
|---|---|
| Client | React 19, TypeScript 6, Vite 8, Tailwind CSS v4, React Router v7, Socket.IO client |
| Server | Node, Express 4, Socket.IO 4, Prisma 6 (SQLite), JWT (httpOnly cookies), bcryptjs, multer, zod |
| Database | SQLite via Prisma (`server/prisma/dev.db`) |
| Audio processing | Pure-Node frame walkers for MP3/M4A/WAV duration; Web Audio API for client-side watermark |

---

## Data model (`server/prisma/schema.prisma`)

### User
| Field | Type | Notes |
|---|---|---|
| id | CUID | PK |
| username | String unique | |
| email | String unique | |
| passwordHash | String | bcrypt |
| bio | String? | |
| avatarSeed | CUID | used to generate deterministic avatar without external service |
| verified | Boolean | seller badge |
| accountType | String | `"both"` default |
| createdAt | DateTime | |

### Sample (auction listing)
| Field | Type | Notes |
|---|---|---|
| id | CUID | PK |
| title / description / genre / key | String | |
| bpm | Int | |
| previewUrl | String | `/uploads/<filename>` — MP3 or M4A, 10–15 s |
| fullAudioUrl | String | `/uploads/<filename>` — WAV, 20–30 s; gated |
| stemsUrl / midiUrl / imageUrl | String? | optional; ZIP for stems/MIDI |
| waveform | String | JSON array of normalized amplitude floats, built server-side from WAV |
| startingPriceCents | Int | |
| currentPriceCents | Int | updated on every bid |
| buyNowPriceCents | Int? | triggers immediate finalization if a bid meets it |
| minIncrementCents | Int | default 100 |
| antiSnipeSeconds | Int | default 30; resets endTime when a bid lands within this window |
| status | String | `"live"` → `"ended"` |
| startTime / endTime | DateTime | endTime updated on anti-snipe extension |
| sellerId | FK → User | |
| winnerId | FK → User? | set on finalization |

### Bid
| Field | Type | Notes |
|---|---|---|
| id | CUID | PK |
| amountCents | Int | |
| sampleId | FK → Sample | indexed |
| userId | FK → User | |
| createdAt | DateTime | |

### Notification
| Field | Type | Notes |
|---|---|---|
| type | String | `outbid` / `won` / `lost` / `sold` / `unsold` |
| message | String | human-readable text |
| read | Boolean | |
| userId / sampleId | FK | |

### Certificate
| Field | Type | Notes |
|---|---|---|
| code | String unique | `SMPL-XXXXXXXX` random hex |
| contentHash | String | SHA-256 of `sampleId:winnerId:amountCents:timestamp` |
| issuedAt | DateTime | |
| sampleId | FK → Sample unique | 1:1 |

---

## Auth

- JWT signed with HS256, 7-day expiry, stored in a `httpOnly` `SameSite=Strict` cookie named `smplbid_token`.
- `attachUser` middleware runs globally on every request, optionally hydrating `req.userId`.
- `requireAuth` middleware returns 401 if `req.userId` is absent.
- Socket.IO identity is derived from the same auth cookie on the WebSocket handshake — clients cannot supply an arbitrary user ID (see `server/src/index.ts:110–116`).
- Rate limiting: auth endpoints (`/api/auth/login`, `/api/auth/register`) are capped at 30 req/15 min; all `/api` routes at 120 req/min.

---

## API routes

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Creates user, sets cookie |
| POST | `/login` | — | Validates password, sets cookie |
| POST | `/logout` | — | Clears cookie |
| GET | `/me` | optional | Returns current user or `null` |

### Samples (`/api/samples`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | optional | List all samples; `?status=live\|ended` filter |
| GET | `/:id` | optional | Sample detail + last 50 bids |
| POST | `/` | required | Create auction (multipart/form-data upload) |
| GET | `/:id/preview` | — | Streams preview audio (no Range support) |
| GET | `/:id/full` | required | Full WAV; seller always, winner after auction ends |
| GET | `/:id/stems` | required | ZIP stems; same access rule as full |
| GET | `/:id/midi` | required | ZIP MIDI; same access rule as full |

### Bids (`/api/samples/:id/bids`)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | required | Place bid; enforces increment, anti-snipe, buy-now |

### Leaderboard (`/api/leaderboard`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | — | Top buyers (total spent) and top sellers (total earned) |

### Notifications (`/api/notifications`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | required | Returns user's notification list |
| POST | `/read-all` | required | Marks all read |

### Certificates (`/api/certificates`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:code` | — | Public certificate lookup by code |

### Users (`/api/users`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:username` | — | Public profile (listings, won samples) |
| PATCH | `/me` | required | Update bio |

### Dashboard (`/api/dashboard`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | required | Seller stats: active listings, total earned, bid counts |

### Vault (`/api/vault`)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | required | Winner's purchased samples with download links |

---

## Socket.IO events

### Rooms
- `sample:<id>` — per-auction room; clients join/leave via `join:sample` / `leave:sample`
- `user:<id>` — private notification room; clients join via `join:user` (identity verified server-side from cookie)

### Server → client events
| Event | Room | Payload |
|---|---|---|
| `bid:new` | `sample:<id>` | `{ sampleId, bid, currentPriceCents, endTime, extended }` |
| `auction:ended` | `sample:<id>` | `{ sampleId, winner: { id, username } \| null }` |
| `notification` | `user:<id>` | `{ type, message, sampleId, ... }` |
| `activity` | broadcast | `{ id, type, sampleId, sampleTitle, username, avatarSeed, amountCents, createdAt }` — emitted on every bid and on finalization |

---

## Auction lifecycle

```
[Seller uploads]
      │
      ▼
 status: "live"   ◄──── endTime extended on anti-snipe bids
      │
      ├── sweepExpiredAuctions() runs every 5 s (setInterval in index.ts)
      │       └── calls finalizeAuction() for each expired sample
      │
      └── bid meets buyNowPriceCents → finalizeAuction() called immediately
                │
                ▼
         status: "ended"
         winnerId set
         Certificate created (SHA-256 + random SMPL-XXXXXX code)
         Notifications sent: won / sold / lost / unsold
         auction:ended emitted to sample room
         activity emitted globally
```

---

## File upload constraints (server-enforced)

| File | Format | Duration / Size |
|---|---|---|
| preview | MP3 or M4A | 10–15 s (±0.5 s tolerance); fallback byte-size check 20–700 KB |
| full | WAV | 20–30 s (±0.5 s tolerance) |
| image | JPEG / PNG / WEBP | validated by magic bytes |
| stems | ZIP | validated by ZIP magic bytes |
| midi | ZIP | validated by ZIP magic bytes |
| global max | — | 25 MB per file |

Extensions are assigned server-side from the validated MIME type; `originalname` from the multipart part is never used to prevent stored-XSS via `express.static`.

---

## Client pages

| Page | Route | Notes |
|---|---|---|
| Home | `/` | Live auction feed + global activity feed |
| Arena | `/arena` | Focused live bidding view |
| SampleDetail | `/samples/:id` | Full auction page with bid history |
| Leaderboard | `/leaderboard` | Top buyers / sellers |
| Auth | `/login`, `/register` | |
| UploadSample | `/upload` | Seller upload form (requires auth) |
| Certificate | `/certificates/:code` | Public certificate viewer |
| Profile | `/users/:username` | Public profile |
| Dashboard | `/dashboard` | Seller stats (requires auth) |
| Vault | `/vault` | Buyer's won samples (requires auth) |

---

## Audio watermarking

`client/src/components/AudioPlayer.tsx` uses the Web Audio API to mix a faint synthetic tone (watermark) into preview playback at the JS layer. The server does not stream with Range header support, so audio scrubbing on the preview endpoint is not possible.

---

## Known gaps (current state, pre-improvement)

- No automated test suite
- `GET /api/samples` returns all rows with no pagination
- Preview endpoint (`GET /api/samples/:id/preview`) does not support HTTP Range headers (no seeking)
- Neither server nor client tsconfig enables `strict: true`
- Activity feed is ephemeral (Socket.IO only; no persistence for users who join mid-session)
- `Sample.status` and `Sample.winnerId` are plain strings/nullable — no DB-level enum constraints
