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

## Meshtastic hardware

QuakeLink extends its range dramatically when paired with Meshtastic LoRa devices. The phone connects to the device over BLE; the device handles all long-range RF. No additional software is needed — just flash Meshtastic firmware and pair.

### Recommended devices

| Device | Price | Notes |
|---|---|---|
| **LilyGo T-Beam Supreme** | ~$35–50 | Best all-around. Built-in GPS + battery management. Accepts any 18650 Li-ion cell. |
| Heltec LoRa 32 v3 | ~$20 | Cheapest entry point. No GPS, requires external antenna for good range. |
| RAK WisBlock 19003 | ~$40–80 | Most professional. Modular, weatherproof options available. |
| Seeed SenseCAP T1000-E | ~$60 | Card-sized, very rugged. Best for carry or field deployment. |

**Frequency band:** Use **868 MHz** for Venezuela and Latin America (ITU Region 2). Confirm local regulations before deploying — some countries use 915 MHz.

### Where to source

- **AliExpress** — LilyGo T-Beam and Heltec ship directly from the manufacturer. Search "LilyGo T-Beam 868" or "Heltec LoRa 32 v3". Shipping to Venezuela takes 3–6 weeks.
- **Amazon** — faster shipping, higher price. Search "Meshtastic T-Beam".
- **Meshtastic official store** — [meshtastic.org](https://meshtastic.org) links to verified sellers.
- **Local electronics communities** — Telegram groups and WhatsApp groups focused on amateur radio (radioafición) in Venezuela often have members who import and resell devices.

### Flashing Meshtastic firmware

1. Download the firmware for your device from [meshtastic.org/downloads](https://meshtastic.org/downloads)
2. Flash via USB using the [Meshtastic web flasher](https://flasher.meshtastic.org) (no tools required)
3. Configure the device with the Meshtastic app — set region to `ANZ` or `EU_868` depending on your local band
4. The device is now discoverable by QuakeLink over BLE

### Deployment strategy for maximum coverage

A single T-Beam on a rooftop or elevated position covers 3–8 km to the next node. Six nodes distributed across a city of 1–2 million people can cover the entire urban area. Recommended placement: water towers, school rooftops, church steeples, high-rise balconies.

---

## Radio range

Range varies significantly with obstacles, antenna quality, and terrain.

### Phone Bluetooth (BLE) — phone to phone directly

| Environment | Typical range |
|---|---|
| Indoors / urban (walls, crowds) | 10–30 m |
| Outdoors, open area | 50–100 m |
| Outdoors, BLE 5.0, line-of-sight | up to 400 m |

BLE is the baseline transport: it works with any two phones within range and requires no additional hardware.

### LoRa — via Meshtastic device bridge

The phone connects to a Meshtastic device over BLE; that device handles all RF. The phone itself adds no extra range — only the Meshtastic radio does.

| Environment | Typical range |
|---|---|
| Dense urban (buildings, interference) | 1–3 km |
| Suburban / light obstruction | 3–10 km |
| Rural, flat terrain | 10–20 km |
| Elevated position, good antenna | 30–50 km |

LoRa mesh nodes relay packets automatically, so the effective network reach is the sum of all hops. A city with 10 Meshtastic nodes spread 2 km apart can cover 20 km end-to-end.

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
