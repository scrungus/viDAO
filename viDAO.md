# StreamDAO — Project Plan

## Overview

A decentralised video streaming platform where users pay a monthly subscription in fiat (converted transparently to USDC), and the entire subscription pool is distributed to creators proportionally by verified engagement. Crypto infrastructure is invisible to end users. The platform looks and feels like a standard streaming service.

---

## Core Economic Model

- Users pay a flat monthly subscription (e.g. £10/month)
- 100% of subscription revenue (minus ~5% protocol fee) goes into a shared USDC pool
- Pool is distributed to creators proportionally by weighted watch hours at end of each period
- No advertising. No platform taking 30–45% like YouTube/Netflix.

### Why this works

The subscription-equals-pool mechanic eliminates random bot farming — a bot paying £10/month can only extract up to £10/month back out. The profitable attack is engagement farming at scale: many devices all watching one creator to inflate their pool share. Hardware attestation makes this prohibitively expensive — each fake session requires a real attested device costing £200–500. At that hardware cost the ROI on pool manipulation is deeply negative.

Note that creator self-farming and third-party engagement-farming-as-a-service are economically identical attacks. Both are addressed by the same constraint.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| L2 blockchain | Base or Arbitrum | Low gas, fast finality, EVM compatible |
| Stablecoin | USDC | Payouts denominated in USDC |
| Device attestation | WebAuthn / Secure Enclave | Hardware-bound keypair, sole trust mechanism |
| Fiat on-ramp | Transak or MoonPay | Card → USDC conversion, invisible to user |
| Video transcoding | Livepeer | Decentralised transcoding layer |
| Video CDN | Cloudflare Stream | Reliable delivery at scale |
| Metadata / thumbnails | IPFS | Decentralised storage for non-video assets |
| Frontend | Next.js | Standard React stack |
| Smart contracts | Solidity | Payout pool, merkle claims |

---

## Device Attestation Model

WebAuthn is the sole trust mechanism. There are no identity tiers, no staking, no fallback trust levels. If a device cannot produce a valid hardware attestation, its watch hours do not count toward the payout pool.

### How it works

During onboarding, the browser registers a WebAuthn credential. On supported devices this generates a keypair inside tamper-resistant hardware — the Secure Enclave on Apple devices, StrongBox on Android. The private key never leaves the chip. Every heartbeat the player emits is signed by this key. The server verifies the attestation level at registration and the signature chain during playback.

A valid hardware-attested signature is cryptographic proof that a specific physical device produced the session. VMs, headless browsers, and software emulation cannot produce valid hardware attestations.

### Device coverage

Hardware attestation is supported on:
- iPhone 5s+ (Secure Enclave, 2013 onwards) — covers essentially all iPhones in active use
- Android with StrongBox — required on all devices shipping with Android 9+ (2018)
- Windows 10+ with TPM 2.0 — mandatory on new PCs since 2016, required for Windows 11
- Mac with T2 chip or Apple Silicon — 2018 onwards

This covers approximately 90%+ of devices used for streaming in developed markets. Devices without hardware attestation can still watch content — they simply do not accumulate engagement weight toward the pool. This is a v1 constraint that can be relaxed later based on adoption data.

### Onboarding flow

1. User signs up, enters card details
2. Embedded wallet created silently (Privy or similar)
3. WebAuthn credential registered in the same step — browser prompts once for biometric/PIN, device generates keypair in Secure Enclave
4. Subscription charged, USDC conversion handled server-side
5. User never sees a wallet address, gas fee, or token

---

## Engagement Scoring

### Watch time cap

- Hard cap: **50 weighted hours per wallet per month**
- Users can watch unlimited content — cap only applies to engagement weight accumulation
- Above 50hrs, watch history still informs recommendations but does not accumulate pool weight

### Why 50hrs

Average real users watch approximately 40hrs/month. If the cap were 150hrs, fake devices could generate 3.75× more hours per £ than a real subscriber — making farming marginally profitable even with hardware costs. At 50hrs the multiplier collapses to ~1.25×, making the attack economics negative when hardware cost is included.

The cap is a manually tuned operational parameter reviewed quarterly against real usage data. It is not dynamic or determined on-chain — an on-chain averaging mechanism would be vulnerable to majority-device governance attacks.

### Heartbeat mechanism

- Player emits a signed heartbeat every 30 seconds
- Each heartbeat is signed by the device's WebAuthn keypair (Secure Enclave)
- Heartbeat payload: wallet address, device key signature, timestamp, session ID, focus state, recent interaction events
- Server validates the full attestation and signature chain on every heartbeat
- Watch time only accumulates during verified active sessions — backgrounded tabs and idle sessions do not accumulate

---

## Anti-Fraud System

The fraud model is simple because hardware attestation does most of the work.

| Attack | Defence |
|---|---|
| VM / headless browser farms | Categorically excluded by hardware attestation |
| Large-scale device farms | Hardware cost (£200–500/device) makes ROI negative |
| AFK farming | Heartbeat requires active session signals |
| Watch time inflation | 50hr monthly cap per wallet |

There is no staking mechanic, no escrow, and no correlation penalty. Staking is unnecessary because hardware is the economic stake. Escrow is unnecessary because attestation validates sessions at creation rather than retrospectively. Correlation penalties are excluded because they are trivially bypassed by anyone who reads the open source code — adding jitter to bot timing defeats the detection while providing false confidence.

---

## Verifiable Payout Architecture

```
Engagement events → Server validation → Aggregation DB
                                              ↓
                                    Weekly merkle root
                                    committed on-chain
                                              ↓
                              Creators verify their inclusion
                              via merkle proof
                                              ↓
                              Creator submits proof to payout
                              contract → contract releases funds
```

- Platform publishes merkle root of all creator engagement scores weekly
- Creators verify their score is correctly included via merkle proof
- Payout contract releases funds on valid proof submission
- No manual disbursement — creators pull their own share

### Open source engagement tracker

- Engagement scoring logic published as open source
- Package version committed on-chain alongside each merkle root
- Creators can audit the exact formula used to calculate their share

---

## Smart Contracts

Deployed with OpenZeppelin's transparent proxy pattern — upgradeable by admin key with 24–48hr timelock. No external audit required at launch:

- Pool resets monthly — maximum exposure at any point is approximately one month of subscriptions
- Upgradeable contracts allow rapid patching of any post-launch findings
- Audit warranted when removing admin control or when TVL becomes material

---

## Subscription & Payments

- Standard card checkout (Stripe-style UX)
- Transak or MoonPay handles fiat → USDC conversion server-side
- User never sees a wallet, gas fees, or token names
- Embedded wallet + WebAuthn registration handled in a single onboarding step
- Subscription renews monthly

---

## Personalisation & Recommendations

- On-chain wallet activity (NFT holdings, token interactions) infers taste — opt-in
- Watch history tied to wallet enables cross-session continuity
- Standard collaborative filtering on top of on-chain signals
- Cold start via region and device signals

---

## Content Moderation

- Staked moderation council — members stake tokens, slashed for bad decisions
- DMCA and CSAM takedowns via legal compliance wrapper (necessarily centralised)
- Protocol-level blacklisting for verified illegal content
- Appeals process with council review

---

## Build Phases

### Weekend 1 — Core scaffold
- Next.js frontend with embedded wallet (Privy) + WebAuthn registration in single onboarding flow
- Video upload and playback (Livepeer + Cloudflare Stream)
- Subscription flow (Transak, USDC on Base testnet)
- Creator dashboard

### Weekend 2 — Economics layer
- Payout pool smart contract on testnet (upgradeable proxy)
- Heartbeat tracking with WebAuthn signature validation
- Engagement score aggregation with 50hr cap
- Creator payout claim flow

### Weeks 3–4 — Closed beta
- Hardware attestation enforcement (reject non-attested sessions from pool scoring)
- Beta with real users to validate attestation coverage and UX friction
- Tune 50hr cap against real usage data

### Weeks 5–6 — Verifiable payouts
- Merkle commitment pipeline (weekly on-chain root)
- Creator verification UI
- Open source engagement tracker published

### Week 7 — Mainnet launch
- Deploy to Base mainnet
- Enable real USDC subscriptions
- Public launch

---

## Key Design Decisions & Rationale

**Why hardware attestation only, no fallback tiers?**
Fallback tiers reintroduce the complexity and attack surface that attestation is meant to eliminate. A two-tier system requires staking, escrow, and separate fraud logic for the soft tier. Hard requirement keeps the system simple and the trust model clean. Devices without attestation can still watch — they just don't influence creator payouts.

**Why WebAuthn specifically?**
WebAuthn is a mature W3C standard with native OS and browser support. The attestation hierarchy (hardware-backed vs software-bound) is built in — no custom trust infrastructure needed. It handles everything from Secure Enclave to older devices in a single standard.

**Why no staking?**
Hardware is the stake. Acquiring attested devices costs £200–500 each. Requiring additional financial stake on top of that adds friction for legitimate users without meaningfully raising the cost for well-resourced attackers.

**Why no escrow?**
Escrow was a retrospective check for when session validity was uncertain. Hardware attestation validates sessions at the point of creation. The risk it was covering no longer exists for attested wallets.

**Why no correlation penalty?**
Open source code means any attacker reads the penalty logic and adds timing jitter to bypass it. It provides false confidence while being trivially defeated. Removed entirely.

**Why no audit at launch?**
Monthly pool reset bounds maximum exposure to one month of subscriptions. Upgradeable contracts allow rapid patching. Audit is warranted at decentralisation, not launch.

**Why 50hr cap?**
Collapses the hours-per-£ multiplier for fake devices to ~1.25×, making farming economically negative when hardware acquisition cost is included. Manually tuned, not dynamic.

**Why USDC not a native token?**
Native tokens introduce speculation dynamics and regulatory complexity. USDC is stable and spendable. Governance token can come later without being the payout currency.

**Why Cloudflare Stream over IPFS?**
IPFS cannot match CDN latency for streaming at scale. Decentralisation is in the economics layer, not the delivery layer.

---

## Open Questions

- Exact subscription price point (£5, £10, £15?) — affects creator economics and attack economics simultaneously
- Minimum pool size at launch to make creator payouts meaningful — may need bootstrapping subsidy
- Re-attestation frequency — how often devices must re-prove hardware validity to prevent stale keys being transferred
- Legal structure for USDC payouts to creators across jurisdictions
- Governance token design — when to introduce, how to distribute, what it controls