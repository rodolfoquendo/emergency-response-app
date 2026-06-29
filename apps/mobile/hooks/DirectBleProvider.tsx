import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import * as BleDirect from '../modules/ble-direct';
import { useIdentity } from '@quakelink/identity';
import { encryptText, decryptText, unb64 } from '@quakelink/crypto';
import type { MeshMessage, MessageType, SendPayload } from '@quakelink/mesh';
import { notifyMessage } from '../lib/alerts';

const NOTIFY_PREVIEW: Partial<Record<MessageType, string>> = {
  location: '📍 Shared a location',
  proof_request: '📟 Proof of living request',
  proof_response: '✅ Alive confirmed',
};

/** Conversation key for the public/everyone chat. */
export const MESH_CONVO = 'mesh';

/**
 * Direct phone-to-phone BLE transport, shared app-wide via context.
 *
 * Two conversation kinds:
 *  - Mesh chat: plaintext broadcast to everyone (convo = 'mesh').
 *  - 1:1 chat: addressed to one contact and end-to-end encrypted with
 *    nacl.box (convo = the other party's signPublicKey). Other mesh members
 *    receive the ciphertext but can't read it and don't display it.
 */

export type DirectPeer = {
  signPublicKey: string;
  boxPublicKey: string;
  alias: string;
  lastSeen: number;
};

export type ChatMessage = MeshMessage & { convo: string };

type Packet = {
  v: 1;
  id: string;
  k: 'msg' | 'hello';
  t?: MessageType;
  x?: string; // plaintext (broadcast) or ciphertext (DM)
  n?: string; // nonce (DM only)
  to?: string; // recipient signPublicKey (DM only)
  s: string; // sender signPublicKey (b64)
  b: string; // sender boxPublicKey (b64)
  a: string; // sender alias
};

type DirectBleValue = {
  messages: ChatMessage[];
  peers: DirectPeer[];
  peerCount: number;
  isConnected: boolean;
  send: (payload: SendPayload, toKey?: string) => Promise<void>;
};

const PEER_TTL_MS = 30_000;
const HELLO_INTERVAL_MS = 5_000;

const DirectBleContext = createContext<DirectBleValue>({
  messages: [],
  peers: [],
  peerCount: 0,
  isConnected: false,
  send: async () => {},
});

async function ensureAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const wanted = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  ].filter(Boolean) as Parameters<typeof PermissionsAndroid.requestMultiple>[0];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  const required = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  ];
  return required.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DirectBleProvider({ children }: { children: ReactNode }) {
  const { identity, contacts } = useIdentity();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<DirectPeer[]>([]);
  const [peerCount, setPeerCount] = useState(0);

  const identityRef = useRef(identity);
  const contactsRef = useRef(contacts);
  const peersRef = useRef<Map<string, DirectPeer>>(new Map());
  const seenIds = useRef<Set<string>>(new Set());

  identityRef.current = identity;
  contactsRef.current = contacts;

  const aliasFor = useCallback((signPublicKey: string, announced: string) => {
    const contact = contactsRef.current.find((c) => c.signPublicKey === signPublicKey);
    return contact?.alias ?? announced;
  }, []);

  const boxKeyFor = useCallback((signPublicKey: string): string | undefined => {
    return (
      contactsRef.current.find((c) => c.signPublicKey === signPublicKey)?.boxPublicKey ??
      peersRef.current.get(signPublicKey)?.boxPublicKey
    );
  }, []);

  const touchPeer = useCallback((p: Packet) => {
    if (!p.s) return;
    peersRef.current.set(p.s, {
      signPublicKey: p.s,
      boxPublicKey: p.b,
      alias: p.a,
      lastSeen: Date.now(),
    });
    setPeers(Array.from(peersRef.current.values()));
  }, []);

  const broadcast = useCallback((packet: Omit<Packet, 'v' | 's' | 'b' | 'a'>) => {
    const id = identityRef.current;
    if (!id) return;
    const full: Packet = {
      v: 1,
      s: id.signPublicKey,
      b: id.boxPublicKey,
      a: id.alias,
      ...packet,
    };
    seenIds.current.add(full.id);
    BleDirect.send(JSON.stringify(full)).catch(() => {});
  }, []);

  const send = useCallback(
    async (payload: SendPayload, toKey?: string) => {
      const me = identityRef.current;
      if (!me) return;
      const id = newId();

      if (toKey) {
        const boxPk = boxKeyFor(toKey);
        if (!boxPk) return; // can't encrypt without the recipient's key
        const enc = encryptText(payload.text, unb64(boxPk), unb64(me.boxSecretKey));
        broadcast({ id, k: 'msg', t: payload.type, x: enc.ciphertext, n: enc.nonce, to: toKey });
      } else {
        broadcast({ id, k: 'msg', t: payload.type, x: payload.text });
      }

      // Optimistic self message (skip consensus-only seismic packets).
      if (payload.type !== 'seismic') {
        const selfMsg: ChatMessage = {
          id,
          text: payload.text,
          type: payload.type,
          fromId: me.signPublicKey,
          fromAlias: 'You',
          fromSelf: true,
          timestamp: Date.now(),
          hops: 0,
          channel: 'ble',
          convo: toKey ?? MESH_CONVO,
        };
        setMessages((prev) => [selfMsg, ...prev].slice(0, 1000));
      }
    },
    [broadcast, boxKeyFor],
  );

  const displayName = identity?.alias ?? 'QuakeLink';
  useEffect(() => {
    let active = true;
    const subs: Array<{ remove: () => void }> = [];

    (async () => {
      const ok = await ensureAndroidPermissions();
      if (!ok || !active) return;

      subs.push(
        BleDirect.addMessageListener(({ text }) => {
          const me = identityRef.current;
          let packet: Packet | null = null;
          try {
            packet = JSON.parse(text) as Packet;
          } catch {
            return;
          }
          if (!packet || packet.v !== 1 || !packet.s) return;
          if (packet.s === me?.signPublicKey) return; // our own echo

          touchPeer(packet);

          if (packet.k !== 'msg' || !packet.id || seenIds.current.has(packet.id)) return;
          seenIds.current.add(packet.id);
          if (seenIds.current.size > 4000) {
            seenIds.current = new Set(Array.from(seenIds.current).slice(-2000));
          }

          const type = (packet.t ?? 'chat') as MessageType;
          const fromAlias = aliasFor(packet.s, packet.a);

          let body: string;
          let convo: string;

          if (packet.to) {
            // Directed (encrypted) message — only the recipient handles it.
            if (!me || packet.to !== me.signPublicKey) return;
            const senderBox = packet.b ?? peersRef.current.get(packet.s)?.boxPublicKey;
            const decoded =
              senderBox && packet.x && packet.n
                ? decryptText(
                    { ciphertext: packet.x, nonce: packet.n },
                    unb64(senderBox),
                    unb64(me.boxSecretKey),
                  )
                : null;
            body = decoded ?? '[unable to decrypt]';
            convo = packet.s; // conversation keyed by the other party
          } else {
            body = packet.x ?? '';
            convo = MESH_CONVO;
          }

          const message: ChatMessage = {
            id: packet.id,
            text: body,
            type,
            fromId: packet.s,
            fromAlias,
            fromSelf: false,
            timestamp: Date.now(),
            hops: 0,
            channel: 'ble',
            convo,
          };
          setMessages((prev) => [message, ...prev].slice(0, 1000));

          if (type !== 'seismic') {
            notifyMessage(fromAlias || 'New message', NOTIFY_PREVIEW[type] ?? body);
          }
        }),
      );

      subs.push(BleDirect.addPeersListener(({ count }) => setPeerCount(count)));

      try {
        await BleDirect.start(displayName);
      } catch {
        /* BLE off / unsupported — degrade silently */
      }
    })();

    const timer = setInterval(() => {
      if (identityRef.current) broadcast({ id: newId(), k: 'hello' });
      const cutoff = Date.now() - PEER_TTL_MS;
      let changed = false;
      for (const [key, p] of peersRef.current) {
        if (p.lastSeen < cutoff) {
          peersRef.current.delete(key);
          changed = true;
        }
      }
      if (changed) setPeers(Array.from(peersRef.current.values()));
    }, HELLO_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
      subs.forEach((s) => s.remove());
      BleDirect.stop().catch(() => {});
    };
  }, [displayName, broadcast, touchPeer, aliasFor]);

  return (
    <DirectBleContext.Provider
      value={{ messages, peers, peerCount, isConnected: peerCount > 0, send }}
    >
      {children}
    </DirectBleContext.Provider>
  );
}

export function useDirectBle(): DirectBleValue {
  return useContext(DirectBleContext);
}
