import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateUUID } from '../utils/uuid';
import { eventBus } from '../core/EventBus';
import { AgentType, PacketType } from '../types';

export type ArtifactStatus = 'draft' | 'complete';

export type Artifact = {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  status: ArtifactStatus;
};

export type EvidenceEntry =
  | {
      kind: 'library_range';
      ts: number;
      docId: string;
      name: string;
      start: number;
      end: number;
      hash: string;
    }
  | {
      kind: 'artifact';
      ts: number;
      artifactId: string;
      name: string;
      hash: string;
    };

export type ArtifactRefResult =
  | { ok: true; id: string; nameHint?: string }
  | { ok: false; code: 'NOT_FOUND' | 'AMBIGUOUS' | 'NO_ACTIVE_ARTIFACT'; userMessage: string };

const MAX_ARTIFACT_CHARS_PER_OP = 50_000;
const MAX_EVIDENCE = 5;

function clampAppendDelta(s: string): string {
  const t = String(s || '');
  if (t.length <= MAX_ARTIFACT_CHARS_PER_OP) return t;
  return t.slice(0, MAX_ARTIFACT_CHARS_PER_OP);
}

function ensureArtifactId(id: string): string {
  const s = String(id || '').trim();
  if (!s.startsWith('art-')) throw new Error('ARTIFACT_ID_INVALID');
  return s;
}

function hashText(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

type ArtifactStoreState = {
  artifactsById: Record<string, Artifact>;
  order: string[];
  evidence: EvidenceEntry[];
  lastCreatedId: string | null;
  lastCreatedAt: number | null;

  create: (name: string, content: string) => string;
  append: (id: string, content: string) => void;
  replace: (id: string, content: string) => void;
  markComplete: (id: string, complete: boolean) => void;
  remove: (id: string) => void;

  get: (id: string) => Artifact | null;
  getByName: (name: string) => Artifact[];
  list: () => Artifact[];

  addEvidence: (e: EvidenceEntry) => void;
  clearEvidence: () => void;

  resetForTesting: () => void;
};

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

type StoreSet = (
  partial:
    | ArtifactStoreState
    | Partial<ArtifactStoreState>
    | ((state: ArtifactStoreState) => ArtifactStoreState | Partial<ArtifactStoreState>),
  replace?: boolean
) => void;

type StoreGet = () => ArtifactStoreState;

const createStore = (set: StoreSet, get: StoreGet): ArtifactStoreState => ({
  artifactsById: {},
  order: [],
  evidence: [],
  lastCreatedId: null,
  lastCreatedAt: null,

  create: (name: string, content: string) => {
    const safeName = String(name || '').trim() || 'artifact.txt';
    const now = Date.now();
    const id = `art-${generateUUID()}`;
    const artifact: Artifact = {
      id,
      name: safeName,
      content: clampAppendDelta(content),
      createdAt: now,
      updatedAt: now,
      status: 'draft'
    };

    set((prev) => ({
      artifactsById: { ...prev.artifactsById, [id]: artifact },
      order: [id, ...prev.order.filter((x: string) => x !== id)],
      lastCreatedId: id,
      lastCreatedAt: now
    }));

    return id;
  },

  append: (id: string, content: string) => {
    const key = ensureArtifactId(id);
    const state = get() as ArtifactStoreState;
    const cur = state.artifactsById[key];
    if (!cur) throw new Error('ARTIFACT_NOT_FOUND');
    const delta = clampAppendDelta(content);
    const nextContent = (cur.content || '') + delta;
    const now = Date.now();
    const updated: Artifact = { ...cur, content: nextContent, updatedAt: now };

    set((prev) => ({
      artifactsById: { ...prev.artifactsById, [key]: updated },
      order: [key, ...prev.order.filter((x: string) => x !== key)]
    }));
  },

  replace: (id: string, content: string) => {
    const key = ensureArtifactId(id);
    const state = get() as ArtifactStoreState;
    const cur = state.artifactsById[key];
    if (!cur) throw new Error('ARTIFACT_NOT_FOUND');
    const now = Date.now();
    const updated: Artifact = { ...cur, content: clampAppendDelta(content), updatedAt: now };

    set((prev) => ({
      artifactsById: { ...prev.artifactsById, [key]: updated },
      order: [key, ...prev.order.filter((x) => x !== key)]
    }));
  },

  markComplete: (id: string, complete: boolean) => {
    const key = ensureArtifactId(id);
    const state = get() as ArtifactStoreState;
    const cur = state.artifactsById[key];
    if (!cur) throw new Error('ARTIFACT_NOT_FOUND');
    const now = Date.now();
    const updated: Artifact = { ...cur, status: complete ? 'complete' : 'draft', updatedAt: now };

    set((prev) => ({
      artifactsById: { ...prev.artifactsById, [key]: updated },
      order: [key, ...prev.order.filter((x) => x !== key)]
    }));
  },

  remove: (id: string) => {
    const key = ensureArtifactId(id);
    const state = get() as ArtifactStoreState;
    const exists = state.artifactsById[key];
    if (!exists) throw new Error('ARTIFACT_NOT_FOUND');
    set((prev) => {
      const nextArtifacts = { ...prev.artifactsById };
      delete nextArtifacts[key];
      return {
        artifactsById: nextArtifacts,
        order: prev.order.filter((x: string) => x !== key),
        evidence: prev.evidence.filter((e: EvidenceEntry) => (e.kind === 'artifact' ? e.artifactId !== key : true))
      };
    });
  },

  get: (id: string) => {
    const key = ensureArtifactId(id);
    const state = get() as ArtifactStoreState;
    return state.artifactsById[key] || null;
  },

  getByName: (name: string) => {
    const target = String(name || '').trim().toLowerCase();
    if (!target) return [];
    const state = get() as ArtifactStoreState;
    return Object.values(state.artifactsById).filter((a) => a.name.toLowerCase() === target);
  },

  list: () => {
    const state = get() as ArtifactStoreState;
    return state.order.map((id) => state.artifactsById[id]).filter(Boolean);
  },

  addEvidence: (e: EvidenceEntry) => {
    const normalized: EvidenceEntry = e;
    set((prev) => ({
      evidence: [normalized, ...prev.evidence].slice(0, MAX_EVIDENCE)
    }));
  },

  clearEvidence: () => {
    set({ evidence: [] });
  },

  resetForTesting: () => {
    set({ artifactsById: {}, order: [], evidence: [], lastCreatedId: null, lastCreatedAt: null });
  }
});

export const useArtifactStore = isTestEnv
  ? create<ArtifactStoreState>()(createStore as any)
  : create<ArtifactStoreState>()(
      persist(createStore as any, {
        name: 'ak-flow:artifacts',
        storage: createJSONStorage(() => localStorage)
      })
    );

function normalizeArtifactRefInput(refRaw: string): string {
  let s = String(refRaw || '').trim();
  if (
    (s.startsWith('<') && s.endsWith('>')) ||
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('`') && s.endsWith('`'))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, ' ');
}

export function normalizeArtifactRef(refRaw: string): ArtifactRefResult {
  const store = useArtifactStore.getState();
  const raw = normalizeArtifactRefInput(refRaw);
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const isImplicit =
    /\btego pliku\b/.test(normalized) ||
    /\bdo tego\b/.test(normalized) ||
    /\bten plik\b/.test(normalized) ||
    /\bostatni\b/.test(normalized) ||
    normalized === 'to';

  if (isImplicit) {
    if (store.lastCreatedId) {
      const hint = store.artifactsById[store.lastCreatedId]?.name;
      return hint ? { ok: true, id: store.lastCreatedId, nameHint: hint } : { ok: true, id: store.lastCreatedId };
    }
    eventBus.publish({
      id: generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: { event: 'EDIT_ARTIFACT_NO_TARGET', raw, reason: 'last_created_missing' },
      priority: 0.6
    });
    return {
      ok: false,
      code: 'NO_ACTIVE_ARTIFACT',
      userMessage: 'Brak aktywnego pliku. Podaj nazwe lub ID (art-123).'
    };
  }

  if (raw.startsWith('art-')) return { ok: true, id: raw };
  if (!raw) {
    return {
      ok: false,
      code: 'NOT_FOUND',
      userMessage: `Nie znalazłem artefaktu ''. Użyj ID (art-123) albo utwórz nowy plik.`
    };
  }

  const candidates: string[] = [raw];
  if (raw.toLowerCase().endsWith('.md')) {
    candidates.push(raw.slice(0, -3));
  } else {
    candidates.push(`${raw}.md`);
  }

  for (const nameCandidate of candidates) {
    const byName = store.getByName(nameCandidate);
    if (byName.length === 1) return { ok: true, id: byName[0].id, nameHint: byName[0].name };
    if (byName.length > 1) {
      return {
        ok: false,
        code: 'AMBIGUOUS',
        userMessage: `Nazwa artefaktu '${nameCandidate}' jest niejednoznaczna. Użyj ID (art-123).`
      };
    }
  }

  return {
    ok: false,
    code: 'NOT_FOUND',
    userMessage: `Nie znalazłem artefaktu '${raw}'. Użyj ID (art-123) albo utwórz nowy plik.`
  };
}

export function hashArtifactContent(content: string): string {
  return hashText(String(content || ''));
}
