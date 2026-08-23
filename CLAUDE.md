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
As specified in CCH.md section 2.4:

**Client**: React Native / Expo (cross-platform iOS, Android, and web)
**Backend**: Supabase (PostgreSQL database, Auth, Storage, Realtime, Row Level Security)
**Payments**: 
- Stripe Connect for payment processing and partner payouts
- RevenueCat for Pass Leader subscription management
**Operations & Services**:
- Resend: Transactional emails
- Sentry: Error tracking and performance monitoring
- PostHog: Product analytics
- Vercel: Web hosting and previews
- Expo EAS: Mobile build and distribution
- Google Maps/Places: Location services (with aggressive caching)

**Key Architectural Decisions**:
- Business-critical logic (confirmation, refunds, spot release) implemented as server-side transactional/idempotent functions
- Realtime used for UI updates only; Postgres remains source of truth
- Player card images can be client-rendered for sharing, with server rendering available if quality/moderation requires

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
- Accessibility, security (RLS), and GDPR compliance are requirements, afterthoughts