# QuakeLink — Emergency Response App

## Project mission

QuakeLink is a **fully offline, peer-to-peer** seismic detection and emergency messaging app for iOS and Android. There are **no servers, no accounts, no central infrastructure of any kind.** Every feature must work when the internet is completely down.

> **Core principle: zero servers, zero surveillance.**
> This project is free and open-source. No data ever leaves the user's device except to nearby peers via BLE/LoRa mesh. No analytics, no telemetry, no cloud relay. Any feature that requires a server must be rejected or redesigned.

---

## Quick start

```bash
make install          # Install all workspace dependencies
make prebuild         # Generate iOS/Android native projects
make pods             # Install CocoaPods (iOS only, requires Xcode)
make ios              # Build and run on iOS Simulator
make android          # Build and run on Android emulator
```

---

## Stack

| Layer | Tech |
|---|---|
| Framework | React Native 0.76 + Expo SDK 52 |
| Navigation | Expo Router v4 (file-based) |
| UI | Tamagui 1.x |
| Charts | @shopify/react-native-skia |
| Monorepo | Turborepo + Yarn workspaces |
| Language | TypeScript 5.8 (strict) |
| iOS sensor | CoreMotion (Swift, Expo Module) |
| Android sensor | SensorManager (Kotlin, Expo Module) |
| Mesh (short) | BLE via react-native-ble-plx + Meshtastic protocol |
| Mesh (long) | LoRa via Meshtastic device bridge |
| Crypto | tweetnacl (NaCl box + Ed25519) + @scure/bip39 |
| Storage | expo-secure-store (encrypted, on-device only) |

---

## Monorepo structure

```
apps/
  mobile/                  ← Expo Router app (iOS + Android)
    app/
      (tabs)/              ← Main screens: seismograph, messages, settings
      onboarding/          ← Identity creation + restore flow
    assets/                ← Placeholder icons/splash (replace before release)

packages/
  crypto/                  ← BIP39 mnemonics, X25519/Ed25519 keys, NaCl encrypt/sign
  identity/                ← SecureStore persistence, IdentityContext, contacts
  seismograph/             ← Native accelerometer module (CoreMotion / SensorManager)
  mesh/                    ← BLE + LoRa Meshtastic transport layer
  consensus/               ← Distributed earthquake detection (sliding-window voting)
  integrations/            ← Webhook outbox (IFTTT, Home Assistant, n8n — user-owned)
  ui/                      ← Tamagui config + shared components (SeismographChart, etc.)
```

---

## Identity model

Each user's identity is a **12-word BIP39 seed phrase** stored only on their device via `expo-secure-store`. There is no registration, no email, no username, no server.

- **Private key** = derived from seed phrase via domain-separated SHA-256 → Ed25519 (sign) + X25519 (encrypt)
- **Public key** = shared as a contact card (deep link or QR code)
- **Restore** = enter seed phrase on a new device → same keypair, same identity

Never store the seed phrase in plain text. Never log keys. Never transmit keys over any network.

---

## Cryptography rules

- All messages are **end-to-end encrypted** with `nacl.box` (X25519 + XSalsa20-Poly1305)
- All messages are **signed** with `nacl.sign.detached` (Ed25519)
- Relay nodes (intermediate hops) **verify signatures but cannot decrypt**
- Replay protection: reject envelopes older than 5 minutes or with future timestamps
- Never roll your own crypto. Use `tweetnacl` and `@scure/bip39` exclusively

---

## Mesh protocol

Messages are `SignedEnvelope` objects that travel over BLE or LoRa:

```ts
type SignedEnvelope = {
  from:       string;   // base64 Ed25519 sender public key
  to:         string;   // base64 X25519 recipient public key
  payload:    EncryptedPayload;   // nacl.box ciphertext + nonce
  sig:        string;   // Ed25519 sig over (nonce + ciphertext + timestamp)
  timestamp:  number;
  ttl:        number;   // decremented at each hop; drop at 0
};
```

Message types: `chat` | `alert` | `sos` | `seismic`

Seismic messages carry `JSON.stringify({ magnitude: number })` as their text and feed the consensus engine.

---

## Earthquake consensus

`packages/consensus` implements distributed seismic detection:

1. Local phone detects high acceleration → `useSeismograph` emits magnitude estimate
2. If magnitude ≥ threshold, phone broadcasts a `seismic` mesh message
3. `ConsensusEngine` collects events in a 30-second sliding window, deduplicated by node
4. When ≥ 3 independent nodes agree → `EarthquakeAlert` is emitted
5. Alert is displayed locally and re-broadcast as an `alert` mesh message

Confidence levels:
- `low` — 3-4 nodes or M2.0-3.4
- `medium` — 5-6 nodes or M3.5+
- `high` — 7+ nodes or M5.0+

Cooldown: 5 minutes between alerts for the same event.

---

## Integrations (webhooks)

`packages/integrations` provides a **user-owned** webhook outbox. No QuakeLink server is involved.

- Users paste their own webhook URL (IFTTT, Home Assistant, Make, n8n, Zapier, etc.)
- On confirmed alert: app POSTs `WebhookPayload` to the user's URL
- Retry: up to 3 attempts with 1s / 5s / 15s backoff
- Optional `X-QuakeLink-Secret` header for signature verification on the user's end

The integration fires **only when internet is available**. Offline operation is never degraded by the absence of a webhook URL.

---

## Working rules

- **No servers.** If a feature requires a server, reject it. This is non-negotiable.
- **No analytics, no telemetry.** Do not add crash reporters, usage trackers, or any SDK that phones home.
- **Offline-first.** Every feature must degrade gracefully with no connectivity. Internet-dependent features (webhooks) are additive bonuses, never requirements.
- **P2P only.** Data flows between devices directly. BLE, LoRa, and local WiFi are the transports.
- **Minimal dependencies.** Prefer audited, small, pure-JS libraries. No black-box SDKs.
- **Surgical changes.** Touch only what the task requires. No speculative abstractions.
- **Simplicity first.** The minimum code that solves the problem. If a senior engineer would call it overcomplicated, simplify it.

---

## Git

- **Never commit in Claude's name.** All commits must be authored solely by the human developer.
- Do not add `Co-Authored-By` trailers naming Claude or any AI agent.


## Communication style
- Respond as briefly as possible. Caveman mode: shortest answer that works. No fluff, no summaries, no "here is what I did".
