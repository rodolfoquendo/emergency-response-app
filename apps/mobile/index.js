// Polyfills must run BEFORE expo-router loads any route files.
// @noble/hashes (via @scure/bip39) captures globalThis.crypto at module-eval
// time, and @quakelink/crypto uses Buffer for base64 — neither exists in
// Hermes by default, so both must be installed before any app code evaluates.
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || Buffer;

// require (not import) so this runs AFTER the polyfills above — ESM imports
// are hoisted, which would otherwise load the app before Buffer is set.
require('expo-router/entry');
