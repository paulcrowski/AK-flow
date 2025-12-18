import { useCallback, useEffect, useRef, useState } from 'react';
import { eventBus } from '../core/EventBus';
import { PacketType } from '../types';

export type TraceHudCopyState = 'idle' | 'ok' | 'fail';

export type TraceHudState = {
  traceId?: string;
  tickNumber?: number;
  skipped?: boolean;
  skipReason?: string | null;
  durationMs?: number;
  lastCommit?: {
    committed?: boolean;
    blocked?: boolean;
    deduped?: boolean;
    blockReason?: string;
    origin?: string;
    counters?: { totalCommits?: number; blockedCommits?: number; dedupedCommits?: number };
  };
} | null;

export function useTraceAnalytics() {
  const [traceHudOpen, setTraceHudOpen] = useState(false);
  const [traceHudCopyState, setTraceHudCopyState] = useState<TraceHudCopyState>('idle');
  const [traceHudFrozen, setTraceHudFrozen] = useState(false);
  const traceHudFrozenRef = useRef(false);
  const [traceHud, setTraceHud] = useState<TraceHudState>(null);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe(PacketType.SYSTEM_ALERT, (packet: any) => {
      const ev = packet?.payload?.event;
      if (!ev) return;

      if (traceHudFrozenRef.current && (ev === 'TICK_START' || ev === 'TICK_SKIPPED' || ev === 'TICK_COMMIT' || ev === 'TICK_END')) {
        return;
      }

      if (ev === 'TICK_START') {
        setTraceHud((prev) => ({
          ...(prev || {}),
          traceId: packet.traceId,
          tickNumber: packet.payload?.tickNumber,
          skipped: false,
          skipReason: null,
          durationMs: undefined
        }));
        return;
      }

      if (ev === 'TICK_SKIPPED') {
        setTraceHud((prev) => ({
          ...(prev || {}),
          traceId: packet.traceId ?? prev?.traceId,
          tickNumber: packet.payload?.tickNumber ?? prev?.tickNumber,
          skipped: true,
          skipReason: packet.payload?.reason ?? packet.payload?.skipReason ?? prev?.skipReason ?? null
        }));
        return;
      }

      if (ev === 'TICK_COMMIT') {
        setTraceHud((prev) => ({
          ...(prev || {}),
          traceId: packet.traceId ?? prev?.traceId,
          tickNumber: packet.payload?.tickNumber ?? prev?.tickNumber,
          lastCommit: {
            committed: packet.payload?.committed,
            blocked: packet.payload?.blocked,
            deduped: packet.payload?.deduped,
            blockReason: packet.payload?.blockReason,
            origin: packet.payload?.origin,
            counters: packet.payload?.counters
          }
        }));
        return;
      }

      if (ev === 'TICK_END') {
        setTraceHud((prev) => ({
          ...(prev || {}),
          traceId: packet.traceId ?? prev?.traceId,
          tickNumber: packet.payload?.tickNumber ?? prev?.tickNumber,
          skipped: packet.payload?.skipped ?? prev?.skipped,
          skipReason: packet.payload?.skipReason ?? prev?.skipReason,
          durationMs: packet.payload?.durationMs
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  const copyTraceToClipboard = useCallback(async (exportPayload: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(exportPayload);
      return;
    }
    if (typeof document !== 'undefined') {
      const el = document.createElement('textarea');
      el.value = exportPayload;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return;
    }
    throw new Error('clipboard_unavailable');
  }, []);

  const sanitizeTracePacketForExport = useCallback((packet: any) => {
    const p = JSON.parse(JSON.stringify(packet));
    if (p?.payload) {
      if (p.payload.imageData && p.payload.imageData.length > 1000) p.payload.imageData = '[VISUAL DATA REMOVED]';
      if (p.payload.image_data && p.payload.image_data.length > 1000) p.payload.image_data = '[VISUAL DATA REMOVED]';
    }
    return p;
  }, []);

  const buildTraceExportPayload = useCallback(
    (packets: any[], meta: { windowMs: number; traceId?: string | null }) => {
      const traceId = meta.traceId ?? null;
      const traceEvents = traceId ? packets.filter((p: any) => p?.traceId === traceId) : [];
      const timestamps = traceEvents.map((p: any) => p?.timestamp).filter((t: any) => typeof t === 'number');
      const minTs = timestamps.length ? Math.min(...timestamps) : null;
      const maxTs = timestamps.length ? Math.max(...timestamps) : null;

      return JSON.stringify(
        {
          traceId,
          tickNumber: traceHud?.tickNumber ?? null,
          durationMs: typeof traceHud?.durationMs === 'number' ? traceHud?.durationMs : null,
          exportedAt: Date.now(),
          windowMs: meta.windowMs,
          tickEnvelope: traceId
            ? {
                traceId,
                minTs,
                maxTs,
                eventCount: traceEvents.length
              }
            : null,
          events: packets.map(sanitizeTracePacketForExport)
        },
        null,
        2
      );
    },
    [sanitizeTracePacketForExport, traceHud]
  );

  const dedupeAndSortPackets = useCallback((packets: any[]) => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const p of packets) {
      const id = p?.id;
      if (typeof id !== 'string') continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(p);
    }
    out.sort((a: any, b: any) => {
      const at = typeof a?.timestamp === 'number' ? a.timestamp : 0;
      const bt = typeof b?.timestamp === 'number' ? b.timestamp : 0;
      return at - bt;
    });
    return out;
  }, []);

  const copyCurrentTrace = useCallback(async () => {
    try {
      const traceId = traceHud?.traceId ?? null;
      const snapA = eventBus.getHistory().slice();
      const merged = dedupeAndSortPackets(snapA);
      const exportPayload = buildTraceExportPayload(merged, { windowMs: 0, traceId });

      await copyTraceToClipboard(exportPayload);

      setTraceHudCopyState('ok');
      setTimeout(() => setTraceHudCopyState('idle'), 1500);
    } catch {
      setTraceHudCopyState('fail');
      setTimeout(() => setTraceHudCopyState('idle'), 2000);
    }
  }, [buildTraceExportPayload, copyTraceToClipboard, dedupeAndSortPackets, traceHud?.traceId]);

  const copyCurrentTraceWithWindow = useCallback(
    async (windowMs: number) => {
      try {
        const traceId = traceHud?.traceId ?? null;
        const snapA = eventBus.getHistory().slice();
        await new Promise((r) => setTimeout(r, Math.max(0, windowMs)));
        const snapB = eventBus.getHistory().slice();
        const merged = dedupeAndSortPackets([...snapA, ...snapB]);
        const exportPayload = buildTraceExportPayload(merged, { windowMs, traceId });

        await copyTraceToClipboard(exportPayload);

        setTraceHudCopyState('ok');
        setTimeout(() => setTraceHudCopyState('idle'), 1500);
      } catch {
        setTraceHudCopyState('fail');
        setTimeout(() => setTraceHudCopyState('idle'), 2000);
      }
    },
    [buildTraceExportPayload, copyTraceToClipboard, dedupeAndSortPackets, traceHud?.traceId]
  );

  const toggleFrozen = useCallback(() => {
    if (!traceHud?.traceId) return;
    setTraceHudFrozen((prev) => {
      const next = !prev;
      traceHudFrozenRef.current = next;
      return next;
    });
  }, [traceHud?.traceId]);

  return {
    traceHud,
    traceHudOpen,
    setTraceHudOpen,
    traceHudCopyState,
    traceHudFrozen,
    toggleFrozen,
    copyCurrentTrace,
    copyCurrentTraceWithWindow
  };
}
