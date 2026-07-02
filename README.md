# SMPLbid

A real-time auction marketplace for exclusive, one-of-one audio samples. Producers compete in live bidding wars; the
winner gets a verifiable certificate of ownership and the full file, and the sample is permanently removed from the
marketplace.

This is a full-stack rebuild of the original SMPLbid concept, with real auth, a live bidding engine, and
trust/growth features layered on top:

- **Real auction mechanics** — live countdown timers, minimum bid increments, buy-now pricing, and eBay-style
  anti-snipe extension (a late bid resets the clock so auctions can't be sniped in the last second).
- **Trust & marketplace features** — verified seller badges, watermarked audio previews (a faint tone is mixed into
  preview playback via the Web Audio API, and the server caps preview byte length so the full track isn't
  downloadable pre-purchase), and a shareable ownership certificate with a content hash for every completed sale.
- **Growth & engagement** — a live global activity feed, a buyer/seller leaderboard, and real-time toast +
  notification-center alerts for outbids, wins, and sales via Socket.IO.

## Stack

- **Client**: React + TypeScript + Vite + Tailwind CSS v4, React Router, Socket.IO client.
- **Server**: Node + Express + Socket.IO, Prisma + SQLite, JWT auth (httpOnly cookies) with bcrypt.

No external services required — SQLite is a local file and demo audio is synthetically generated, so it runs
entirely offline after `npm install`.

## Getting started

### 1. Server

```bash
cd server
npm install
npx prisma migrate dev   # first time only — creates dev.db
npm run seed              # populates demo users, live auctions, and sold history
npm run dev                # starts the API + Socket.IO server on :4000
```

### 2. Client

```bash
cd client
npm install
npm run dev   # starts Vite on :5173, proxying /api and /socket.io to :4000
```

Open http://localhost:5173.

### Demo login

Every seeded user shares the password `password123`. Try `kaidenmakes`, `luna_waves`, `trapgodhenry`,
`sundriedsamples`, `mira_beats`, or `dj_ohmega` on the login screen, or just register a new account.

## Re-seeding

`npm run seed` (from `server/`) wipes and repopulates the database and `uploads/` folder with a fresh set of demo
auctions — some ending in minutes so you can watch the anti-snipe/ending flow without waiting hours.

## Project layout

```
server/
  prisma/schema.prisma   # User, Sample, Bid, Notification, Certificate models
  src/routes/            # auth, samples, bids, leaderboard, notifications, certificates, users
  src/lib/auctionEngine.ts  # finalizes auctions (winner selection, certificates, notifications)
  src/lib/genTone.ts     # generates license-free synthetic WAV demo audio for seeding
client/
  src/pages/             # Home, Arena, SampleDetail, Leaderboard, Auth, UploadSample, Certificate, Profile
  src/components/        # AudioPlayer (watermarking), Waveform, CountdownBadge, SampleCard, Header
  src/context/           # Auth, Toast, Notification providers (Socket.IO-driven)
```
