# QuakeLink — Emergency Response App

## Project mission

QuakeLink is a **fully offline, peer-to-peer** seismic detection and emergency messaging app for iOS and Android. There are **no servers, no accounts, no central infrastructure of any kind.** Every feature must work when the internet is completely down.

> **Core principle: zero servers, zero surveillance.**
> This project is free and open-source. No data ever leaves the user's device except to nearby peers via BLE/LoRa mesh. No analytics, no telemetry, no cloud relay. Any feature that requires a server must be rejected or redesigned. This is non-negotiable and is the founding constraint of the project.

---

## Development commands

```bash
make install          # yarn install across the monorepo
make prebuild         # expo prebuild (generates ios/ and android/)
make prebuild-sync    # re-run prebuild after adding native deps (skips reset)
make prebuild-clean   # full clean + prebuild
make pods             # pod install (iOS, requires Xcode + CocoaPods)
make ios              # pods + expo run:ios
make android          # expo run:android
make start            # expo start (JS only)
make type-check       # turbo type-check across all packages
make lint             # turbo lint across all packages
make clean            # remove ios/, android/, .expo/, dist/
make reset            # full nuke: clean + rm node_modules + reinstall
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

### Package reference

| Package | Purpose |
|---|---|
| `@quakelink/crypto` | BIP39, X25519/Ed25519 keys, NaCl encrypt/sign, contact cards |
| `@quakelink/identity` | SecureStore persistence, `IdentityProvider`, `useIdentity` |
| `@quakelink/seismograph` | Native module: CoreMotion (iOS) / SensorManager (Android) |
| `@quakelink/mesh` | BLE + LoRa Meshtastic transport, `useMesh` |
| `@quakelink/consensus` | Distributed earthquake detection, `ConsensusEngine`, `useConsensus` |
| `@quakelink/integrations` | Webhook outbox for user-owned automations, `useIntegrations` |
| `@quakelink/ui` | Tamagui config + `SeismographChart`, `AlertBanner`, `MessageBubble` |

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
- Use `tweetnacl` only. Do not introduce `libsodium`, WebCrypto, or any other crypto library
- Use `@scure/bip39` for mnemonics. Do not use the `bip39` npm package (unaudited)
- Key derivation must remain domain-separated: `sha256(entropy + "quakelink-sign-v1")` for Ed25519, `sha256(entropy + "quakelink-box-v1")` for X25519. Do not change these domain strings — it would invalidate all existing identities

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

## Adding a new native dependency

Whenever a new native package is added (iOS/Android native code):

1. Add to `apps/mobile/package.json`
2. Run `make install`
3. Run `make prebuild-sync` (re-generates native projects)
4. Run `make pods` (iOS)
5. Run `make ios` or `make android`

Do **not** manually edit `ios/` or `android/` — they are generated by `expo prebuild` and should not be committed.

---

## Working rules

- **No servers.** If a feature requires a server, reject it. This is non-negotiable.
- **No analytics, no telemetry.** Do not add crash reporters, usage trackers, or any SDK that phones home.
- **Offline-first.** Every feature must degrade gracefully with no connectivity. Internet-dependent features (webhooks) are additive bonuses, never requirements.
- **P2P only.** Data flows between devices directly. BLE, LoRa, and local WiFi are the transports.
- **Minimal dependencies.** Prefer audited, small, pure-JS libraries. No black-box SDKs.
- **Think before coding.** State assumptions explicitly. If the request is ambiguous, ask.
- **Simplicity first.** Write the minimum code that solves the problem. If a senior engineer would call it overcomplicated, simplify it.
- **Surgical changes.** Touch only what the task requires. No speculative abstractions.

---

## Git

- **Never commit in Claude's name.** All commits must be authored solely by the human developer.
- Do not add `Co-Authored-By` trailers naming Claude or any AI agent.

See `.ai/guidelines/git-safety.md` for rules on not discarding working-tree changes via git commands.

---

## Communication style
- Respond as briefly as possible. Caveman mode: shortest answer that works. No fluff, no summaries, no "here is what I did".

---

## Guardrails

- Protected paths (directories that must never be created, edited, moved, or deleted): see `.ai/guidelines/protected-paths.md`.
