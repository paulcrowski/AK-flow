type TokenUsageRecord = {
  at: number;
  agentId: string | null;
  op: string;
  inTokens: number;
  outTokens: number;
  totalTokens: number;
};

type TokenUsageTotals = {
  inTokens: number;
  outTokens: number;
  totalTokens: number;
};

type TokenUsageSnapshot = {
  totals: TokenUsageTotals;
  byOp: Record<string, TokenUsageTotals>;
  recent: TokenUsageRecord[];
};

const clamp0 = (n: unknown) => {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? Math.trunc(x) : 0;
};

const makeTotals = (): TokenUsageTotals => ({ inTokens: 0, outTokens: 0, totalTokens: 0 });

let totals: TokenUsageTotals = makeTotals();
let byOp: Record<string, TokenUsageTotals> = {};
let recent: TokenUsageRecord[] = [];

export const TokenUsageLedger = {
  record(input: {
    agentId: string | null;
    op: string;
    inTokens: unknown;
    outTokens: unknown;
    totalTokens: unknown;
    at?: number;
  }) {
    const op = String(input.op || '').trim() || 'unknown';
    const rec: TokenUsageRecord = {
      at: input.at ?? Date.now(),
      agentId: input.agentId ?? null,
      op,
      inTokens: clamp0(input.inTokens),
      outTokens: clamp0(input.outTokens),
      totalTokens: clamp0(input.totalTokens)
    };

    totals = {
      inTokens: totals.inTokens + rec.inTokens,
      outTokens: totals.outTokens + rec.outTokens,
      totalTokens: totals.totalTokens + rec.totalTokens
    };

    const cur = byOp[op] ?? makeTotals();
    byOp = {
      ...byOp,
      [op]: {
        inTokens: cur.inTokens + rec.inTokens,
        outTokens: cur.outTokens + rec.outTokens,
        totalTokens: cur.totalTokens + rec.totalTokens
      }
    };

    recent = [...recent, rec].slice(-200);
  },

  snapshot(): TokenUsageSnapshot {
    return {
      totals,
      byOp,
      recent
    };
  },

  reset() {
    totals = makeTotals();
    byOp = {};
    recent = [];
  }
};

export type { TokenUsageRecord, TokenUsageSnapshot, TokenUsageTotals };
