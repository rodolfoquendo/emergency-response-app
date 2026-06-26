# QuakeLink

A fully offline, peer-to-peer seismic detection and emergency messaging app for iOS and Android.

**No servers. No accounts. No cloud infrastructure of any kind.** Every feature works when the internet is completely down. Data never leaves your device except to nearby peers via BLE/LoRa mesh.

---

## How it works

1. Each device's accelerometer continuously monitors for unusual motion.
2. When a significant event is detected, the device broadcasts a signed `seismic` message to nearby peers over Bluetooth or LoRa.
3. A sliding-window consensus engine collects reports from independent nodes. When ≥ 3 agree within 30 seconds, a local `EarthquakeAlert` is raised and re-broadcast across the mesh.
4. Users can also send encrypted peer-to-peer chat, SOS, and alert messages — all routed through the same mesh with no relay server.

---

## Quick start

```bash
make install      # Install all workspace dependencies
make prebuild     # Generate iOS/Android native projects
make pods         # Install CocoaPods (iOS only, requires Xcode)
make ios          # Build and run on iOS Simulator
make android      # Build and run on Android emulator
```

Requires Node ≥ 20, Yarn 4, Xcode (iOS), Android Studio (Android).

---

## Stack

| Layer | Tech |
|---|---|
| Framework | React Native 0.76 + Expo SDK 52 |
| Navigation | Expo Router v4 (file-based) |
| UI | Tamagui 1.x + @shopify/react-native-skia |
| Monorepo | Turborepo + Yarn workspaces |
| Language | TypeScript 5.8 (strict) |
| iOS sensor | CoreMotion (Swift, Expo Module) |
| Android sensor | SensorManager (Kotlin, Expo Module) |
| Mesh (short-range) | BLE via react-native-ble-plx + Meshtastic protocol |
| Mesh (long-range) | LoRa via Meshtastic device bridge |
| Crypto | tweetnacl (NaCl box + Ed25519) + @scure/bip39 |
| Storage | expo-secure-store (encrypted, on-device only) |

---

## Monorepo structure

```
apps/
  mobile/               ← Expo Router app (iOS + Android)
    app/
      (tabs)/           ← Main screens: seismograph, messages, settings
      onboarding/       ← Identity creation + restore flow

packages/
  crypto/               ← BIP39 mnemonics, X25519/Ed25519 keys, NaCl encrypt/sign
  identity/             ← SecureStore persistence, IdentityContext, contacts
  seismograph/          ← Native accelerometer module (CoreMotion / SensorManager)
  mesh/                 ← BLE + LoRa Meshtastic transport layer
  consensus/            ← Distributed earthquake detection (sliding-window voting)
  integrations/         ← Webhook outbox (IFTTT, Home Assistant, n8n — user-owned)
  ui/                   ← Tamagui config + shared components (SeismographChart, etc.)
```

---

## Identity

Each user's identity is a **12-word BIP39 seed phrase** stored only on their device via `expo-secure-store`. No registration, no email, no username, no server.

- **Private key** — derived from seed phrase → Ed25519 (sign) + X25519 (encrypt)
- **Public key** — shared as a contact card via deep link or QR code
- **Restore** — enter your seed phrase on a new device to recover the same keypair

---

## Cryptography

All messages are end-to-end encrypted with `nacl.box` (X25519 + XSalsa20-Poly1305) and signed with `nacl.sign.detached` (Ed25519). Relay nodes verify signatures but cannot decrypt. Envelopes older than 5 minutes or with future timestamps are rejected.

---

## Earthquake consensus

- **Confidence low** — 3–4 nodes or M2.0–3.4
- **Confidence medium** — 5–6 nodes or M3.5+
- **Confidence high** — 7+ nodes or M5.0+
- **Cooldown** — 5 minutes between alerts for the same event

---

## Webhook integrations (optional)

Users can paste their own webhook URL (IFTTT, Home Assistant, Make, n8n, Zapier, etc.). On a confirmed alert the app POSTs a payload to that URL with up to 3 retries. No QuakeLink server is involved. Offline operation is never degraded by the absence of a webhook URL.

---

## License

GPL-3.0-only with a special exception allowing distribution through the Apple App Store and Google Play while the source remains publicly available under GPLv3. See [LICENSE](LICENSE).
