# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primary Specification
The main product specification is documented in `CCH.md`. This file contains:
- Complete functional requirements (MoSCoW prioritized)
- Non-functional requirements (performance, security, accessibility, etc.)
- Technical architecture proposal
- Development roadmap (V0 → V4)
- Critical user paths
- Cost estimates and timelines

## Technical Architecture

**This section describes what the repository actually contains.** `CCH.md`
section 2.4 describes the same intent at product level; where the two ever
disagree, the code wins.

**Self-hosted, no BaaS.** Everything runs on our own VPS via
`docker-compose.yml`, behind a Traefik instance that already existed on that
server (the `traefik` network is declared `external`). Public host:
`five.alng.fr`, with `PathPrefix(/api)` routed to the backend container and
everything else to the frontend's nginx.

**Backend** — `backend/`, not a workspace (own `package-lock.json`):
- Express 4 + Sequelize 6 + PostgreSQL 15
- Auth: JWT signed in-process (`backend/src/middleware/auth.ts`), access token
  1 h / refresh token 30 d, with a `type` claim so one can never stand in for
  the other. `verifyAccessToken` is the single verification point.
- Validation: Joi schemas in `backend/src/utils/validationSchemas.ts`, applied
  by the `validateRequest` middleware.
- Schema: TypeScript Umzug migrations in `backend/src/migrations/`. **There are
  no `.sql` files, and `sequelize.sync()` is never used.** Migrations run at
  server boot (`backend/src/server.ts`), which assumes a single backend
  instance — see the comment in `backend/src/db/migrator.ts`.
- Media: MinIO (S3-compatible), abstracted behind `backend/src/services/storage.ts`,
  which falls back to an in-memory implementation in dev and test. MinIO is not
  publicly exposed; objects are served back by the API itself through the
  public `GET /api/media/:key`.
- Realtime: a `ws` server on `/api/ws/chat` (`backend/src/ws/`), attached to the
  HTTP server by `server.ts` **and** `devserver.ts`. `app.ts` stays listen-free
  so supertest can import it.

**No Row Level Security.** Authorization lives in the controllers. The shared
guards are in `backend/src/utils/groupAccess.ts` (`canViewGroup`,
`requireGroupAdmin`, `requireGroupMember`) — reuse them rather than writing a
fourth copy. Two conventions worth knowing:
- A non-member of a **private** group gets **404, not 403**: its very existence
  is none of their business. The one deliberate exception is the group chat,
  where a **public** group returns 403 — its existence is already public, and
  the client can say "join to read" instead of "not found".
- User data is serialized through `PUBLIC_USER_ATTRIBUTES`
  (`backend/src/utils/publicAttributes.ts`), an allowlist. Never hand-pick
  columns; that file documents a past leak of email and phone.
- Account deletion is **anonymization**, never `DELETE` (migration `0003`):
  every FK to `users` is `ON DELETE CASCADE`, so a real delete would take other
  players' data with it. Content survives and renders as "Compte supprimé".

**Clients** — two, maintained in parallel:
- `apps/mobile` — Expo Router v4 + NativeWind, targets iOS, Android **and** web.
  New Architecture is disabled on purpose. Platform splits use
  `.native.ts` / `.web.ts` plus a `.d.ts` shim, not `.web.tsx` components.
- `frontend/` — Vite + React + react-router + Tailwind. This is the app
  deployed at five.alng.fr and the only one the Playwright suite drives. It is
  **not** an npm workspace and cannot resolve `five-api-client`; shared code is
  deliberately duplicated there (`services/api.ts`, `services/chatSocket.ts`,
  `mediaSrc`) rather than wired up, to avoid two axios singletons racing on
  refresh-token rotation.

**Shared packages** (workspaces, consumed by `apps/mobile` only):
- `packages/api-client` — axios singleton, session storage, single-flight 401
  refresh, chat socket transport.
- `packages/ui` — cross-platform primitives, `confirmAsync`, and a `mitt`
  event bus (`eventBus`) used for cross-screen signals. There is no React
  Context and no state manager anywhere; screens fetch with
  `useState`/`useEffect` + `api.get`.

**Data fetching**: no React Query, no SWR, no Redux, no Zustand. Match the
surrounding pattern rather than introducing one.

**Not wired yet.** These appear in `CCH.md` as product intent and have **no
implementation** — do not assume they exist:
Stripe Connect, RevenueCat, Resend (`services/mailer.ts` is a console stub),
Sentry, PostHog, Expo push notifications (the `notifications` table is
persisted and read in-app only), and Google Maps/Places.

**Key architectural decisions**:
- Business-critical logic (confirmation, spot release, and later refunds) lives
  in server-side transactional functions, not in the client.
- **Realtime is for UI updates only; Postgres remains the source of truth.**
  The chat socket pushes nothing it has not already written, and clients
  reconcile after every reconnect via `GET /groups/:id/messages?since=` — a
  socket is not a durable queue.
- Player card images can be client-rendered for sharing, with server rendering
  available if quality or moderation requires it.

## Core Modules & Features
Based on the MoSCoW requirements in CCH.md:

**Essential (Must-have) for V1**:
- Accounts & Profiles (email/phone/social login, avatar, visibility controls)
- Groups (creation, invitations, roles, join/leave, member list)
- Events (creation with date/time/location/capacity, statuses, inscriptions, shareable links)
- Notifications (event pushes, transactional emails, non-response reminders)
- Social (anti-spam, external sharing to WhatsApp)
- Player Discovery (public minimal profiles, blocking)
- Back-office (dashboard, moderation, support, assisted refunds, audit log)
- Partners (partner attribution)

**Key Differentiators (V1.5)**:
- **Payment & Pot**: Payment = reservation condition, collective pot per event, automatic spot release
- **FiveComposer & Player Cards**: 
  * Auto-generated player cards (FIFA/FUT style from profile)
  * Visual terrain editor (5v5, 6v6, etc.)
  * Auto team generation algorithm (serpentine sort by rating, with manual adjustment)
  * Team composition sharing (export/share to WhatsApp/chat)

**Planned Enhancements**:
- V2: Social features (group feed, event chat), player ratings/post-match, card evolution, player discovery, advanced recurrences, partner integrations
- V3+: Tournaments, merchandise, B2B features, partner commissions

## Critical User Paths
Four essential flows to prioritize (CCH.md section 2.6):
1. **Create an event**: Organizer sets up event → shares link → tracks responses
2. **Reserve and pay**: Player views event → pays → gets confirmation (or waitlist if late)
3. **Generate teams**: Organizer uses FiveComposer → selects teams → algorithm proposes → manual adjustment → share composition
4. **Join group**: Player accepts invitation → completes minimal profile → sees upcoming events

## Development Approach
- Estimated ~110 person-hours with Opus 5 acceleration (vs ~208 without)
- V1 focuses on core event creation/filling without payment
- V1.5 adds monetization (Payment/Pot) and differentiation (FiveComposer)
- Recommended validation: Tight loop with Reims group before expanding features
- Metrics to track: Session completion rate, retention, organizer pain point reduction

## Implementation Notes
- When implementing, refer to CCH.md for detailed requirement IDs and priorities
- The FiveComposer is highlighted as a key viral differentiator - prioritize clean, shareable output
- Payment complexity (refunds, service fees, cancellation rules) should be deferred to V1.5 per spec
- Accessibility, authorization, and GDPR compliance are requirements, not
  afterthoughts. Authorization is enforced in controllers (there is no RLS) —
  every new endpoint needs its own test asserting what a non-member gets.
- The schema changes only through a new numbered migration in
  `backend/src/migrations/`; new tables must also be added to the `TABLES`
  array truncated in `backend/test/setup.ts`, or later suites turn flaky.
- Tests: `cd backend && npm test` (Jest + supertest against a real embedded
  Postgres, `maxWorkers: 1`). Browser journeys: `cd frontend && npm run e2e`,
  which needs `PLAYWRIGHT_CHROMIUM_PATH` in this environment.