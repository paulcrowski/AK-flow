import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Finding = {
  file: string;
  line: number;
  kind: 'let' | 'var' | 'newMap' | 'newSet' | 'newWeakMap' | 'newWeakSet';
  text: string;
};

function walk(dirAbs: string): string[] {
  const out: string[] = [];
  for (const ent of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const abs = path.join(dirAbs, ent.name);
    if (ent.isDirectory()) {
      // Keep this audit scoped and stable
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      out.push(...walk(abs));
      continue;
    }

    if (!ent.isFile()) continue;
    if (!abs.endsWith('.ts') || abs.endsWith('.test.ts')) continue;
    out.push(abs);
  }
  return out;
}

function findGlobalStateFindings(fileAbs: string): Finding[] {
  const rel = path.relative(process.cwd(), fileAbs).replace(/\\/g, '/');
  const text = fs.readFileSync(fileAbs, 'utf8');
  const lines = text.split(/\r?\n/);

  const out: Finding[] = [];

  // Heuristic audit: module-level (top-level) mutable vars + module-level caches.
  // IMPORTANT: we only count column-0 declarations to avoid flagging local variables.
  const stopAfterLine = Math.min(lines.length, 300);

  for (let i = 0; i < stopAfterLine; i++) {
    const line = lines[i];

    // Ignore obvious comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    const mLet = /^let\s+([A-Za-z0-9_]+)\b/.exec(line);
    if (mLet) {
      out.push({ file: rel, line: i + 1, kind: 'let', text: line.trim() });
    }

    const mVar = /^var\s+([A-Za-z0-9_]+)\b/.exec(line);
    if (mVar) {
      out.push({ file: rel, line: i + 1, kind: 'var', text: line.trim() });
    }

    const mMap = /^const\s+([A-Za-z0-9_]+)\s*=\s*new\s+Map\b/.exec(line);
    if (mMap) out.push({ file: rel, line: i + 1, kind: 'newMap', text: line.trim() });

    const mSet = /^const\s+([A-Za-z0-9_]+)\s*=\s*new\s+Set\b/.exec(line);
    if (mSet) out.push({ file: rel, line: i + 1, kind: 'newSet', text: line.trim() });

    const mWeakMap = /^const\s+([A-Za-z0-9_]+)\s*=\s*new\s+WeakMap\b/.exec(line);
    if (mWeakMap) out.push({ file: rel, line: i + 1, kind: 'newWeakMap', text: line.trim() });

    const mWeakSet = /^const\s+([A-Za-z0-9_]+)\s*=\s*new\s+WeakSet\b/.exec(line);
    if (mWeakSet) out.push({ file: rel, line: i + 1, kind: 'newWeakSet', text: line.trim() });
  }

  return out;
}

// Allowlist = known existing module-level state that is explicitly tolerated for now.
// This test protects against regressions (new global mutable state).
const ALLOWLIST: Array<{ file: string; kind?: Finding['kind']; contains?: string }> = [
  { file: 'src/core/systems/TickCommitter.ts', kind: 'let' },
  { file: 'src/core/systems/TickCommitter.ts', kind: 'newMap', contains: 'lastSpeechByAgent' },
  { file: 'src/core/systems/PrismMetrics.ts', kind: 'let', contains: 'dailyPenalty' },
  { file: 'src/core/systems/FactEchoPipeline.ts', kind: 'let', contains: 'consecutiveFailures' },
  { file: 'src/core/systems/evaluation/createEvaluationEvent.ts', kind: 'let', contains: 'eventIdCounter' },
  { file: 'src/core/systems/ChemistryBridge.ts', kind: 'let', contains: 'activeSubscription' },
  { file: 'src/core/systems/IntentContract.ts', kind: 'newSet', contains: 'const STYLE' },
  { file: 'src/core/systems/IntentContract.ts', kind: 'newSet', contains: 'const COMMAND' },
  { file: 'src/core/systems/IntentContract.ts', kind: 'newSet', contains: 'const URGENCY' },
];

function isAllowlisted(f: Finding): boolean {
  return ALLOWLIST.some((a) => {
    if (a.file !== f.file) return false;
    if (a.kind && a.kind !== f.kind) return false;
    if (a.contains && !f.text.includes(a.contains)) return false;
    return true;
  });
}

describe('GlobalStateAudit', () => {
  it('should not introduce new module-level mutable state under core/systems', () => {
    const systemsRoot = path.join(process.cwd(), 'src', 'core', 'systems');
    const files = walk(systemsRoot);

    const findings: Finding[] = [];
    for (const f of files) {
      findings.push(...findGlobalStateFindings(f));
    }

    const nonAllowed = findings.filter((f) => !isAllowlisted(f));

    if (nonAllowed.length > 0) {
      const msg = nonAllowed
        .map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`)
        .join('\n');
      expect(msg).toBe('');
    }

    expect(nonAllowed.length).toBe(0);
  });
});
