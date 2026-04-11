# StreamDAO — MVP

## Goal

Demonstrate the core loop end-to-end with real money: a user pays a subscription, watches content, and a creator receives a proportional payout from the pool. Everything else is deferred.

---

## What the MVP is

- A single-page streaming site with a small curated catalogue (seed with 5–10 creator uploads)
- WebAuthn registration on signup — hardware attestation enforced, no fallback
- Heartbeat-based watch time tracking with 50hr monthly cap
- A USDC subscription pool on Arbitrum Sepolia (real wallet, fake money for now)
- Automatic weekly payout distribution to creators proportional to weighted watch hours
- A minimal creator dashboard showing earnings and watch stats

## What the MVP is not

- A content discovery product (no recommendations, no search — just a homepage grid)
- A content moderation system (manual review only, invite-only creators at launch)
- Decentralised anything — single server, single DB, no merkle commitments yet
- Mobile apps

The goal is to validate that the economic model works and that WebAuthn attestation is not a UX dealbreaker. Everything else is built on top of a confirmed core loop.

---

## User flows

### Viewer onboarding
1. Land on homepage, see content grid (visible without account)
2. Click any video → prompted to sign up to watch
3. Enter email + card details (Transak handles fiat → USDC)
4. Browser prompts for WebAuthn registration (Face ID / fingerprint / PIN) — one tap
5. Embedded wallet created silently in background
6. User lands on video, playback starts

### Viewer watching
1. Player loads, WebAuthn credential verified against wallet
2. Signed heartbeat emitted every 30 seconds
3. Watch hours accumulate up to 50hr monthly cap
4. No visible indication of any of this — normal streaming UX

### Creator onboarding
- Invite only at MVP
- Creator connects wallet, uploads video via dashboard
- Sets title, description, thumbnail

### Payout
- Weekly cron job aggregates watch hours per creator
- Proportional split of pool calculated server-side
- USDC transferred to creator wallets directly
- Creator dashboard shows that week's earnings and watch hour breakdown

---

## Pages

Four pages total. All UI generated via Google Stitch MCP.

**`/` — Homepage**
- Header: logo, sign in, subscribe CTA
- Grid of video thumbnails with creator name and view count
- No categories, no search, no filters

**`/watch/[id]` — Video player**
- Full-width video player (Cloudflare Stream embed)
- Title, creator name, description below
- Related videos sidebar (just most recent uploads for MVP)

**`/dashboard` — Creator dashboard**
- Total earnings this period
- Watch hours this period vs last period
- Video list with per-video watch hours
- Upload button

**`/onboarding` — Sign up flow**
- Step 1: email + card details
- Step 2: WebAuthn registration prompt
- Step 3: redirect to homepage

---

## Data model

```
User
  id
  email
  wallet_address
  webauthn_credential_id
  webauthn_attestation_type   -- "hardware" | "software" (software = excluded from pool)
  subscribed_until
  created_at

Video
  id
  creator_id
  title
  description
  cloudflare_stream_id
  thumbnail_url
  created_at

WatchSession
  id
  user_id
  video_id
  started_at
  last_heartbeat_at
  weighted_seconds          -- only increments if attestation = hardware and under monthly cap

MonthlyWatchTotal
  user_id
  month                     -- YYYY-MM
  weighted_hours            -- capped at 50

PayoutPeriod
  id
  period_start
  period_end
  total_pool_usdc
  status                    -- pending | distributed

CreatorPayout
  id
  payout_period_id
  creator_id
  watch_hours
  share_percentage
  usdc_amount
  tx_hash
```

---

## Backend

Three core services, all in a single Next.js API:

**Heartbeat endpoint** `POST /api/heartbeat`
- Validates WebAuthn signature on every call
- WebAuthn assertion with user verification — requires biometric/PIN, confirms user is present and consenting. Used at login.
- Assertion without user verification — device signs silently, no prompt, just proves the same hardware key is still active. This is what you'd use for heartbeats.
- Confirms attestation type is hardware
- Checks user is within monthly 50hr cap
- Increments weighted_seconds on active WatchSession
- Rejects silently if any check fails — no error surfaced to client

**Subscription webhook** `POST /api/subscription/webhook`
- Called by Transak (in sandbox mode for MVP) on successful payment
- Deposits USDC into payout pool contract on Arbitrum Sepolia
- Sets subscribed_until = now + 30 days on User

**Payout cron** runs weekly
- Aggregates weighted watch hours per creator for the period
- Calculates each creator's share percentage
- Calls payout pool contract to distribute USDC to creator wallets
- Records CreatorPayout rows with tx hashes

---

## Smart contract

Single Rust Stylus contract on Arbitrum Sepolia. Written in Rust, compiled to WASM via the Arbitrum Stylus toolchain. Two public functions only:

```rust
sol_storage! {
    #[entrypoint]
    pub struct PayoutPool {
        address owner;
        address usdc_token;
        uint256 pool_balance;
    }
}

#[public]
impl PayoutPool {
    // called by subscription webhook
    // transfers USDC from platform wallet into pool
    pub fn deposit(&mut self, amount: U256) -> Result<(), Vec<u8>> { ... }

    // called by payout cron (owner only)
    // transfers amounts[i] USDC to creators[i]
    // amounts must sum to <= pool balance
    pub fn distribute(
        &mut self,
        creators: Vec<Address>,
        amounts: Vec<U256>,
    ) -> Result<(), Vec<u8>> { ... }
}
```

Upgradeable proxy not needed at MVP — testnet only, no real money. Deploy simple contract, redeploy if anything needs changing.

### Dev stack

Smart contracts use the **Arbitrum Stylus** stack:

- **Language:** Rust compiled to WASM via `stylus-sdk`
- **Build/test/deploy:** Hardhat with `@cobuilders/hardhat-arbitrum-stylus` plugin
- **CLI tasks:** `npx hardhat arb:compile`, `npx hardhat arb:test`, `npx hardhat arb:deploy`
- **Local dev node:** `npx hardhat arb:node start` (Docker-based Arbitrum node)
- **Alternative:** Direct `cargo-stylus` CLI for compile/check/deploy without Hardhat
- **Claude Code skill:** Use `/arbitrum-stylus` for scaffolding, contract patterns, and up-to-date docs via Context7

---

## Frontend instructions for Claude Code

Use Google Stitch MCP to generate all four pages. Pass the following context to each Stitch call:

**Design brief for all pages:**
- Dark theme, minimal, content-forward
- Think early Netflix meets crypto-native — no garish token aesthetics
- Primary action colour: a single accent (suggest deep violet or electric blue)
- Video thumbnails: 16:9 aspect ratio, creator avatar + name overlaid bottom-left
- Typography: clean sans-serif, generous spacing
- No visible crypto UI anywhere — no wallet addresses, no gas, no token names

**Per-page Stitch prompts:**

These are rough outlines. if you think more detail is needed then you can add it. 

Homepage: "A dark streaming platform homepage. Full-width header with logo left, 'Sign in' and 'Subscribe' buttons right. Below: a grid of video thumbnail cards, each with a 16:9 thumbnail image, video title, and creator name. Minimal, content-forward, Netflix-dark aesthetic."

Watch page: "A dark video watch page. Full-width video player at top. Below player: video title large, creator name with small avatar, description text. Right sidebar: vertical list of related video thumbnails. Clean and focused."

Creator dashboard: "A dark creator analytics dashboard. Top row: three metric cards showing total earnings, watch hours this period, watch hours last period. Below: a table of uploaded videos with columns for title, watch hours, and earnings. Upload video button top right."

Onboarding: "A clean dark multi-step sign up flow. Step 1: email input and card payment form. Step 2: a large centered prompt explaining biometric registration with a single 'Register device' button. Step 3: success state with redirect. Minimal, trustworthy."

---

## What success looks like

At the end of the MVP build:
- A real user on a real attested device can sign up, pay, and watch a video
- Their watch hours accumulate correctly and stop at 50hrs
- A creator can log into the dashboard and see their earnings
- The weekly payout runs and USDC lands in creator wallets on Arbitrum Sepolia
- WebAuthn registration completes without confusion for a non-technical user
- a good test suite for verifying all of our backend logic and also any smart contract related logic

If all five of those work, the core loop is validated and the full build can begin.

---

## Deferred to post-MVP

- Merkle commitments and verifiable payouts
- Open source engagement tracker
- Content moderation council
- Search, recommendations, categories
- Mobile apps
- Arbitrum One mainnet deployment
- Governance token
- Re-attestation logic