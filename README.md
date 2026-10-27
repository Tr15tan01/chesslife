# DealCraft

An AI negotiation simulator and practical decision-making trainer. Players negotiate with characters who have hidden priorities, limits and facts, then receive a scored debrief with alternatives and replay.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Radix UI · CSS motion (reduced-motion aware) · React Three Fiber + Drei · **MongoDB Atlas** (official driver) · **custom session auth** (email/password with Argon2id + Google OIDC with PKCE) · Zod · Recharts · Vitest · Playwright.

---

## Contents

1. [Quick start](#quick-start)
2. [Configuration](#configuration)
3. [MongoDB Atlas setup](#mongodb-atlas-setup)
4. [Google sign-in](#google-sign-in)
5. [AI providers](#ai-providers)
6. [Admin accounts](#admin-accounts)
7. [Scripts and tests](#scripts-and-tests)
8. [Deployment](#deployment)
9. [Architecture](#architecture)
10. [Game modes](#game-modes)
11. [Scoring](#scoring)
12. [Security](#security)
13. [Data model, retention and deletion](#data-model-retention-and-deletion)
14. [Known limitations and next steps](#known-limitations-and-next-steps)

---

## Quick start

Requirements: Node.js 20.9+ (22 recommended), npm.

```bash
npm install
cp .env.example .env.local
```

**Zero-setup demo** (no database, no keys): set `DATABASE_URL=memory://local` in `.env.local`. The in-memory store is seeded automatically on first request and wiped on restart. It is refused in production.

**With MongoDB Atlas** (recommended): put your Atlas connection string in `DATABASE_URL`, then:

```bash
npm run db:setup     # creates indexes and seeds 26 scenarios, 10 academy paths, 7 challenges
npm run dev          # http://localhost:3000
```

Classic mode is fully playable without any AI configuration. To try AI mode without an API key, set `AI_ENABLED=1` and `AI_PROVIDER=mock` (deterministic, clearly labelled as simulated in the UI).

## Configuration

All variables are documented in [`.env.example`](.env.example). Summary:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | MongoDB Atlas URI including the database name (`…mongodb.net/dealcraft?…`). `memory://…` for dev/tests only. |
| `AUTH_SECRET` | Production | ≥ 32 random chars. Signs OAuth state cookies. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `AUTH_URL` | Production | Public base URL. Used for OAuth redirect URI, email links, same-origin checks, and secure-cookie decisions. |
| `GOOGLE_AUTH_ENABLED` | No | `1` enables Google sign-in (needs the two values below), `0` disables provider and UI entirely. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | If Google on | OAuth client credentials. If missing while enabled, Google stays off and a server-side error is logged. |
| `AI_ENABLED` | No | `0` disables every external AI call. |
| `AI_PROVIDER` | If AI on | `google`, `openai`, `anthropic` or `mock`. |
| `AI_API_KEY` | If real provider | Server-only key. Never exposed to the browser. |
| `AI_MODEL_NEGOTIATION`, `AI_MODEL_EVALUATION`, `AI_MODEL_SCENARIO` | No | Per-task model overrides (defaults per provider in `src/server/ai/providers.ts`). |
| `ADMIN_EMAILS` | No | Comma-separated emails promoted to ADMIN **only after the address is verified**. |
| `RATE_LIMIT_ENABLED` | No | Defaults to on. |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Enables verification and password-reset emails. Without them, dev prints links to the server console; production reports that email reset is unavailable. |

Configuration is validated with Zod (`src/server/env.ts`). Optional integrations are validated when used, so a missing optional integration never prevents startup.

**Development vs production**

- Development: `memory://` allowed, a fixed dev-only secret is used if `AUTH_SECRET` is missing, cookies are not `Secure` on `http://`.
- Production: `AUTH_SECRET` (≥ 32 chars) is mandatory, `memory://` is refused (unless `DEALCRAFT_ALLOW_MEMORY_DB=1`, used only by the e2e suite), cookies are `Secure` when `AUTH_URL` is `https://`, and CSP adds `upgrade-insecure-requests`.

## MongoDB Atlas setup

1. Create a cluster (M0 is fine for development).
2. Database Access: create a user with `readWrite` on the `dealcraft` database only.
3. Network Access: allow your host's egress IPs (avoid `0.0.0.0/0` in production; use private endpoints or peering if your host supports it).
4. Copy the SRV connection string, add the database name to the path, put it in `DATABASE_URL`.
5. Run `npm run db:setup`. It is idempotent: re-running updates changed seed scenarios by creating **new versions** (finished games keep the version they were played on).

Indexes (created automatically on connect, see `src/server/db/index.ts`) include unique indexes on `users.email`, `oauth_accounts.(provider, providerAccountId)`, `scenarios.slug`, `scenario_versions.(scenarioId, version)`, `lesson_completions.(userId, lessonId)`, plus TTL indexes that expire sessions, auth tokens, rate-limit windows and error logs.

## Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application).
2. Authorised redirect URI: `${AUTH_URL}/api/auth/google/callback`.
3. Set `GOOGLE_AUTH_ENABLED=1`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. No code changes are needed to switch it on or off.

The flow uses OpenID Connect with PKCE (S256), `state` and `nonce` held in a short-lived, HMAC-signed, HttpOnly cookie scoped to `/api/auth/google`. The ID token is verified against Google's JWKS (issuer, audience, nonce). See [account linking rules](#authentication).

## AI providers

The AI layer (`src/server/ai`) is provider-independent: one transport per provider (`google` Gemini, `openai` Chat Completions, `anthropic` Messages, `mock`) behind a single `complete()` call with per-task models, a timeout, and one bounded retry for malformed output.

- **Character** (`character.ts`): words the counterpart's reply. The deterministic engine has already decided the offer/accept/walk outcome; the model is told the decision and cannot change it. It never receives hidden limits, and only receives facts the player has earned rapport for. Replies are schema-validated and checked for leaked limit numbers; on failure a rules-based reply is used and labelled.
- **Evaluator** (`evaluator.ts`): grades five qualitative dimensions from the transcript. Scores are validated (0–100), clamped to ±15 of the rules score, averaged, and labelled "AI-assessed". Outcome, preparation and offer strategy are always rules-only.
- **Scenario flavour** (`custom.ts`): optional name/bio/opening line for custom scenarios. Numbers and hidden rules are always generated deterministically.

When AI is disabled, unavailable, rate-limited or over quota, the UI says so and offers **Continue in Classic mode**, which switches the live game without losing progress. AI usage (provider-reported tokens and estimated cost) is recorded per call and visible to admins.

## Admin accounts

Administrators are never created from a registration field. Two supported routes:

- `ADMIN_EMAILS=you@company.com` — promoted to ADMIN after that address is verified (email link, completed password reset, or Google verified email).
- From a shell with database access: `npm run admin:grant -- someone@example.com ADMIN` (or `CONTENT_MANAGER` / `USER`). This revokes the user's sessions and writes an audit log entry.

Roles: `USER`, `CONTENT_MANAGER` (scenarios and academy content only), `ADMIN` (plus users, roles, suspensions, feature flags, AI usage, error logs and audit log). Admins cannot change their own role or suspend themselves.

## Scripts and tests

```bash
npm run dev            # development server
npm run build          # production build
npm start              # serve the production build
npm run lint           # ESLint (eslint-config-next, core-web-vitals + TypeScript)
npm run typecheck      # tsc --noEmit (strict, noUncheckedIndexedAccess)
npm test               # Vitest: unit + integration (in-memory DB, no network)
npm run test:e2e       # Playwright against two production servers (build first)
npm run check          # lint + typecheck + tests + build
npm run db:setup       # indexes + seed (Atlas)
npm run admin:grant -- <email> <ROLE>
```

**Test coverage**

- Unit (50 tests): scenario validation and hidden-data separation, state transitions, offer clamping, counterpart limits and no-retraction (property test across all 26 scenarios), deflection and branching dialogue, final-offer/walk-out, turn limits, expiry, keyword matching, deterministic scoring, walk-away scenario scoring, challenge criteria, AI schema validation, AI score bounding, fact gating, leak detection, safe redirects, permissions, password policy, signed cookies, quotas, streaks, custom scenario generation.
- Integration (35 tests, real Route Handlers): registration/login, generic errors, role mass-assignment, rate limiting, CSRF rejection, auth required, single-use reset tokens with session rotation, logout, `ADMIN_EMAILS` bootstrap only after verification, Google enabled/disabled/misconfigured, PKCE request, no auto-linking by email, full Classic game with evaluation persistence and progress, no hidden data in views, idempotent retries, optimistic concurrency, cross-user isolation, client cannot force outcomes, server-enforced timers, pause/resume, replay without mutating the original, challenge locks, AI-disabled operation, mock-AI game with usage and blended evaluation, switching AI→Classic, admin/content-manager permissions, audited role changes with session revocation, suspension, data export, account deletion, analytics from persisted data only, preference whitelisting.
- End-to-end (8 Playwright tests): register → Classic game → offers → deterministic counteroffer → completion → results; determinism across runs; AI game with the mock provider and AI-assessed evaluation; cross-user game access blocked; non-admin blocked from admin; signed-out redirect; full Classic play on a server with AI disabled; landing page live preview and navigation.

No test calls a paid model API. If Playwright's browser download is blocked in your environment, point it at an existing Chromium with `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

## Deployment

Any Node host that runs `next start` works (Vercel, Render, Fly.io, Railway, a container).

1. Set environment variables from `.env.example` (production values). `AUTH_URL` must be your public `https://` origin.
2. `npm ci && npm run build && npm run db:setup` (db:setup can run once from CI or your machine).
3. `npm start` (or your platform's default for Next.js).
4. Health check: `GET /api/health`.
5. Behind a proxy/CDN, make sure `X-Forwarded-For` is set by the trusted proxy (rate limiting keys on the first forwarded IP).

Pages are dynamically rendered because every response carries a per-request CSP nonce.

## Architecture

```
src/
  app/
    (site)/        public website: landing, scenarios, how-it-works, features, pricing, about, faq, legal, contact
    (auth)/        login, register, forgot/reset password, verify email
    (app)/         authenticated app: dashboard, play, results, training, challenges, progress, history, custom, profile, settings, admin
    api/           Route Handlers (all mutations; Zod-validated; CSRF/authz enforced in one wrapper)
  components/      UI primitives, marketing, app shell, play, results, charts (Recharts), three (R3F scene)
  lib/negotiation  isomorphic types, formatting and the client-visible GameView shape
  server/
    env.ts         validated configuration
    db/            collection contract + MongoDB driver implementation + in-memory implementation (tests/demo)
    auth/          sessions, Google OIDC, permissions, page guards
    security/      Argon2id, rate limiting, signed payloads, redirect validation
    engine/        deterministic negotiation engine, counterpart strategy, evaluation  (pure, no I/O)
    content/       26 seeded scenarios, academy, challenges, validation, idempotent seeding
    ai/            provider transports, character, evaluator, mock provider
    services/      games, completion, analytics, accounts, training, custom, admin, flags, usage, logging
  proxy.ts         CSP nonce + optimistic redirect for app routes (Next 16 "proxy", formerly middleware)
```

**Service boundaries:** Route Handlers only parse, authorise and delegate. Business logic lives once in `server/services`; the negotiation rules live once in `server/engine` and are shared by every mode. Server Components read through the same services.

**Negotiation engine** (`server/engine/engine.ts`): a pure function `step(context, state, action) → { state, turns, status, outcome }`. State is explicit (`turn`, bargaining `clock`, `phase`, `trust`, discovered facts, asked/used moves, offer history, current offers, final-offer flag, counters, agreement). Statuses: `CREATED → ACTIVE ⇄ PAUSED → AGREEMENT_REACHED | WALKED_AWAY | FAILED | EXPIRED`.

**Counterpart strategy** (`server/engine/counterpart.ts`): each counterpart has hidden targets, limits, issue weights, an opening offer, a firmness exponent (time-dependent concession: hard-liners concede late), a utility floor, starting trust, a walk threshold and patience. It concedes fastest on issues it values least (so trading across issues creates value), never retracts, never passes its limits, accepts offers that meet its current aspiration (or beat its own next counter), issues a final offer when patience runs out and leaves if that offer is ignored. Rapport, reasons and discovered facts lower its floor; pressure and bluffs raise the walk-out risk. Difficulty changes strategy and information-sharing, not rudeness.

**Persistence and concurrency:** every accepted move is appended in a single atomic `findOneAndUpdate` guarded by the game's `version` (optimistic concurrency). Each mutation carries a client idempotency key; replays of a processed key return the stored result. Completion is exactly-once without multi-document transactions: the evaluation uses the game id as its `_id`, and progress is applied behind a `progressApplied` compare-and-set. (Atlas supports transactions too; this design also works on the in-memory store.)

**3D:** the hero table scene is lazy-loaded after `requestIdleCallback`, uses only procedural low-poly geometry (no external textures or HDRs, which keeps CSP strict), falls back to a static SVG without WebGL, uses `frameloop="demand"` and disables motion under `prefers-reduced-motion`, and is only loaded on the landing page and scenario detail pages.

## Game modes

| Mode | Where | Notes |
|---|---|---|
| AI negotiation | Play → AI | Free text + structured offers. Engine decides, AI words, signals adjust future rapport. |
| Classic | Play → Classic | Question list, points to make, offer composer, accept/reject/ask-for-better/pause/walk. Free text is keyword-matched and labelled as such. |
| Quick | Play → Quick rounds | Seven short scenarios (2–5 min). |
| Timed | Any scenario | Server-side deadline; the browser timer is display only. Pausing stores remaining time. |
| Academy | /training | 10 learning paths, worked weak/strong examples, server-checked quizzes, linked practice scenarios. |
| Challenges | /challenges | 7 progressively unlocked challenges with objective criteria (turn limits, budget caps, required discoveries, walk-away). Unlocks are enforced server-side. |
| Replay & improve | Results → "Replay from here" | Creates a new game from a stored engine snapshot; the original is never modified. |
| Custom | /custom | Structured builder; hidden counterpart generated deterministically from your limits and difficulty. Optional AI flavour text. Private to the owner. |

## Scoring

Eight dimensions with scenario-specific weights (category presets, overridable per scenario and editable by content managers, which creates a new version): outcome quality, preparation, information gathering, offer strategy, communication, value creation, emotional control (observable behaviour only), ethics & relationship.

- Deterministic facts: agreed terms, player utility between their own limit and the counterpart's hidden limit, whether a deal zone existed, whether walking away was best, own-limit breaches, offers and concession sizes (shrinking concessions are rewarded), trade-offs across issues, discoveries, question timing, pressure and bluff usage, final rapport, joint value achieved vs the best available package.
- Each dimension carries a short rationale. The report includes strengths, missed opportunities, key moments, concrete alternative moves with their consequences, three suggestions targeting the weakest dimensions, the scenario takeaway, and a recommended next scenario chosen for the weakest dimension.
- The UI states that scores reflect actions in the simulator and are not a measure of personality or real-world ability.

## Security

**Authentication**

- Passwords hashed with Argon2id (`memoryCost 19 MiB, timeCost 2`), never stored or logged in plaintext. Password policy: 10–128 chars, letters plus digits/symbols, common-password block list.
- Sessions: 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` (on https), path-`/` cookie. Only the SHA-256 of the token is stored. 30-day sliding expiry with TTL clean-up. Sessions are bound to the user's `authVersion`; password change/reset, role change, suspension and "sign out everywhere" invalidate all sessions. Login rotates any pre-existing session.
- Generic login errors and timing-equalised password checks for unknown accounts. Registration responds identically whether or not the email exists (the real owner is notified by email when configured).
- Password-reset (30 min) and email-verification (24 h) tokens are random, stored hashed, single-use (atomically consumed) and expire via TTL.
- Google: OIDC with PKCE, `state`, `nonce`, JWKS-verified ID token (issuer + audience), verified email required. **No automatic account linking by email**: if a password account exists, the user must sign in with the password and link Google from Settings. Linking requires an authenticated session and a link-intent state.
- Redirect targets are restricted to same-origin relative paths (`safeRedirect`).

**Authorisation**

- Identity, role and plan come only from the server-side session. Every Route Handler declares `auth` or a `permission`; services re-check permissions for admin operations. Pages use `requireUser`/`requirePermission`; unauthorised users get a not-found page that does not confirm existence.
- Ownership is part of every game query (`{ _id, userId }`), so other users' games are indistinguishable from missing ones.
- Explicit field whitelists on every update (no mass assignment); roles cannot be self-assigned and admins cannot change their own role.

**Request handling**

- CSRF: cookie-authenticated mutations require a matching `Origin` (or `Referer`) in addition to `SameSite=Lax`.
- Zod validation for bodies, params and query strings; 32 KB request-body limit; message and notes length limits.
- Rate limits (MongoDB-backed fixed windows, shared across instances) on login (per IP and per email), registration, reset, OAuth, game starts, turns, AI turns, AI evaluation, AI scenario generation, contact form and admin actions. Daily AI turn quotas per plan (admin-configurable).
- Security headers: per-request nonce CSP with `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, restricted `form-action` and `img-src`; `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, HSTS.
- Injection: queries are built from typed values; user search input is regex-escaped. React escapes all rendered user content; no `dangerouslySetInnerHTML` is used.
- SSRF: the server only calls fixed provider URLs (Google OAuth/JWKS, AI providers, Resend). There is no user-supplied URL fetching.
- Errors: clients get generic messages; server logs are structured and redact token/password/key patterns; request bodies and conversation content are never logged.

**AI-specific**

- System instructions are separated from user content; player text is wrapped and declared untrusted. Custom scenario text cannot alter system prompts, limits or rules.
- Hidden limits are never sent to the model; facts are sent only once the player has earned them. Replies are schema-validated, checked for leaked limit values and fall back to rules-based text (labelled) on failure.
- No model-generated code or tool calls are executed. Input, output tokens, conversation length (`maxTurns`) and request rates are bounded; timeouts and provider errors map to clear "use Classic mode" messages.
- Evaluator scores are validated and bounded, and cannot change objective facts.

**Privacy and admin**

- Administrators cannot read conversation transcripts; there is no privileged transcript access in this release.
- Admin actions (role changes, suspensions, content edits, flag changes, CLI grants) are written to an audit log.
- Users can export all their data as JSON and delete their account (password or typed confirmation required).

**Dependency hygiene:** `npm audit` reports advisories only in the ESLint toolchain (`eslint-config-next` → `fast-glob` → `micromatch`), a dev-only dependency not shipped to production. Run `npm audit --omit=dev` to check runtime dependencies.

**Production checklist:** strong `AUTH_SECRET`; `https://` `AUTH_URL`; Atlas user with least privilege and restricted network access; `RATE_LIMIT_ENABLED=1`; email provider configured for verification and resets; review the legal templates; set `ADMIN_EMAILS` or use `admin:grant`; keep `AI_API_KEY` in your host's secret store.

## Data model, retention and deletion

Collections: `users`, `oauth_accounts`, `sessions`, `auth_tokens` (password reset + email verification), `scenarios`, `scenario_versions` (public and private halves stored separately; immutable versions), `games` (state, turns, offers, snapshots, idempotency keys, outcome, agreement), `evaluations`, `user_progress`, `training_programs`, `training_lessons`, `lesson_completions`, `challenges`, `user_preferences`, `usage_records`, `audit_logs`, `rate_limits`, `feature_flags`, `error_logs`, `contact_messages`.

Retention: sessions expire 30 days after last use; auth tokens within 24 hours; rate-limit windows at the end of the window; error logs after 30 days. Training data persists until the user deletes it. Account deletion removes the user, sessions, tokens, linked OAuth accounts, games, evaluations, progress, preferences, lesson completions and custom scenarios (with their versions); AI usage records are anonymised (kept for cost accounting); audit entries remain.

## Known limitations and next steps

- **Billing** is not implemented. Plans (`FREE`/`PREMIUM`) exist server-side and drive AI quotas; to add billing, integrate a provider (e.g. Stripe), verify webhooks server-side and set `users.plan` only from verified events.
- **Streaming AI replies** are not implemented; replies arrive as one validated JSON object (validation before display is the priority).
- Classic free text uses keyword matching only, and the UI says so.
- The in-memory store emulates the MongoDB operations this app uses (via `mingo`) for tests and demos; production uses the official MongoDB driver against Atlas.
- Email delivery uses Resend's HTTP API when configured; other providers can be added in `src/server/services/email.ts`.
