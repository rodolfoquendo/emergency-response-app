import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { MeshMessage, SendPayload } from '@quakelink/mesh';
import type { Identity, StoredContact } from '@quakelink/identity';

export type ProofRequest = {
  messageId: string;
  requestId: string;
  fromAlias: string;
  receivedAt: number;
};

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function useProofOfLiving({
  sendMessage,
  messages,
  myIdentity,
}: {
  sendMessage: (payload: SendPayload) => Promise<void>;
  messages: MeshMessage[];
  myIdentity: Identity | null;
}) {
  // Timestamp of last explicit "I'm alive" confirmation from this user.
  // Stored in both a ref (for the effect) and state (to drive UI re-renders).
  const provenAtRef = useRef<number | null>(null);
  const [provenAt, setProvenAt] = useState<number | null>(null);

  // Request IDs we have already sent a proof_response for — avoids duplicates.
  const respondedIds = useRef<Set<string>>(new Set());

  // When the user explicitly confirms alive, update cache.
  const confirmAlive = useCallback(() => {
    const now = Date.now();
    provenAtRef.current = now;
    setProvenAt(now);
  }, []);

  // Request proof of living from a specific contact.
  const requestProof = useCallback(
    async (contact: StoredContact, myAlias: string) => {
      const requestId = `pof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await sendMessage({
        type: 'proof_request',
        text: JSON.stringify({ requestId, toKey: contact.signPublicKey, fromAlias: myAlias }),
      });
    },
    [sendMessage],
  );

  // Auto-respond to incoming requests addressed to me when cache is valid.
  useEffect(() => {
    if (!myIdentity) return;

    for (const msg of messages) {
      if (msg.type !== 'proof_request' || msg.fromSelf) continue;

      let parsed: { requestId: string; toKey: string; fromAlias?: string };
      try { parsed = JSON.parse(msg.text); } catch { continue; }

      if (parsed.toKey !== myIdentity.signPublicKey) continue;
      if (respondedIds.current.has(parsed.requestId)) continue;

      const pa = provenAtRef.current;
      if (!pa || Date.now() - pa >= CACHE_TTL) continue;

      respondedIds.current.add(parsed.requestId);
      sendMessage({
        type: 'proof_response',
        text: JSON.stringify({ requestId: parsed.requestId, provenAt: pa, fromCache: true }),
      });
    }
  }, [messages, myIdentity, sendMessage]);

  // Pending requests: addressed to me, not yet responded, cache expired → need manual confirmation.
  const pendingRequests = useMemo<ProofRequest[]>(() => {
    if (!myIdentity) return [];
    return messages
      .filter((msg) => {
        if (msg.type !== 'proof_request' || msg.fromSelf) return false;
        try {
          const { requestId, toKey } = JSON.parse(msg.text);
          return (
            toKey === myIdentity.signPublicKey &&
            !respondedIds.current.has(requestId)
          );
        } catch { return false; }
      })
      .map((msg) => {
        const { requestId, fromAlias } = JSON.parse(msg.text);
        return { messageId: msg.id, requestId, fromAlias: fromAlias ?? 'Unknown', receivedAt: msg.timestamp };
      });
  }, [messages, myIdentity]);

  // Respond to ALL pending requests now (used when user manually confirms alive).
  const confirmAliveAndRespond = useCallback(() => {
    confirmAlive();
    const now = Date.now();
    for (const req of pendingRequests) {
      if (respondedIds.current.has(req.requestId)) continue;
      respondedIds.current.add(req.requestId);
      sendMessage({
        type: 'proof_response',
        text: JSON.stringify({ requestId: req.requestId, provenAt: now, fromCache: false }),
      });
    }
  }, [confirmAlive, pendingRequests, sendMessage]);

  const cacheExpiresAt = provenAt ? provenAt + CACHE_TTL : null;
  const cacheValid = cacheExpiresAt !== null && Date.now() < cacheExpiresAt;

  return {
    confirmAlive,
    confirmAliveAndRespond,
    requestProof,
    pendingRequests,
    provenAt,
    cacheValid,
    cacheExpiresAt,
  };
}
