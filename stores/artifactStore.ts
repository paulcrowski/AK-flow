import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateUUID } from '../utils/uuid';

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

  create: (name: string, content: string) => string;
  append: (id: string, content: string) => void;
  replace: (id: string, content: string) => void;
  markComplete: (id: string, complete: boolean) => void;

  get: (id: string) => Artifact | null;
  list: () => Artifact[];

  addEvidence: (e: EvidenceEntry) => void;
  clearEvidence: () => void;

  resetForTesting: () => void;
};

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

const createStore = (set: any, get: any): ArtifactStoreState => ({
      artifactsById: {},
      order: [],
      evidence: [],

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
          order: [id, ...prev.order.filter((x) => x !== id)]
        }));

        return id;
      },

      append: (id: string, content: string) => {
        const key = ensureArtifactId(id);
        const cur = get().artifactsById[key];
        if (!cur) throw new Error('ARTIFACT_NOT_FOUND');
        const delta = clampAppendDelta(content);
        const nextContent = (cur.content || '') + delta;
        const now = Date.now();
        const updated: Artifact = { ...cur, content: nextContent, updatedAt: now };

        set((prev) => ({
          artifactsById: { ...prev.artifactsById, [key]: updated },
          order: [key, ...prev.order.filter((x) => x !== key)]
        }));
      },

      replace: (id: string, content: string) => {
        const key = ensureArtifactId(id);
        const cur = get().artifactsById[key];
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
        const cur = get().artifactsById[key];
        if (!cur) throw new Error('ARTIFACT_NOT_FOUND');
        const now = Date.now();
        const updated: Artifact = { ...cur, status: complete ? 'complete' : 'draft', updatedAt: now };

        set((prev) => ({
          artifactsById: { ...prev.artifactsById, [key]: updated },
          order: [key, ...prev.order.filter((x) => x !== key)]
        }));
      },

      get: (id: string) => {
        const key = ensureArtifactId(id);
        return get().artifactsById[key] || null;
      },

      list: () => {
        const { order, artifactsById } = get();
        return order.map((id) => artifactsById[id]).filter(Boolean);
      },

      addEvidence: (e: EvidenceEntry) => {
        const ts = typeof (e as any)?.ts === 'number' ? (e as any).ts : Date.now();
        const normalized: EvidenceEntry = { ...(e as any), ts };
        set((prev) => ({
          evidence: [normalized, ...prev.evidence].slice(0, MAX_EVIDENCE)
        }));
      },

      clearEvidence: () => {
        set({ evidence: [] });
      },

      resetForTesting: () => {
        set({ artifactsById: {}, order: [], evidence: [] });
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

export function hashArtifactContent(content: string): string {
  return hashText(String(content || ''));
}
