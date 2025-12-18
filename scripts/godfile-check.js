import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const DEFAULT_SOFT_LIMIT = 500;
const DEFAULT_HARD_LIMIT = 700;

const softLimit = Number.parseInt(process.env.GODFILE_SOFT_LIMIT || '', 10) || DEFAULT_SOFT_LIMIT;
const hardLimit = Number.parseInt(process.env.GODFILE_HARD_LIMIT || '', 10) || DEFAULT_HARD_LIMIT;

const DEFAULT_ALLOWLIST = new Set([
  'core/systems/EventLoop.ts',
  'ak-nexus/src/stores/nexusStore.ts'
]);

const ALLOWLIST = new Set([
  ...DEFAULT_ALLOWLIST,
  ...(process.env.GODFILE_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
]);

const INCLUDE_EXT = new Set(['.ts', '.tsx']);
const EXCLUDE_DIR = new Set(['node_modules', 'dist', '.git', 'coverage', 'ak-nexus/node_modules', 'docs']);

function isExcludedDir(relPath) {
  const parts = relPath.split(/[\\/]/g).filter(Boolean);
  if (parts.length === 0) return false;
  if (EXCLUDE_DIR.has(parts[0])) return true;
  // nested node_modules
  return parts.includes('node_modules');
}

function walk(dirAbs, relBase) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  const files = [];

  for (const ent of entries) {
    const rel = relBase ? path.posix.join(relBase, ent.name) : ent.name;
    const abs = path.join(dirAbs, ent.name);

    if (ent.isDirectory()) {
      if (isExcludedDir(rel)) continue;
      files.push(...walk(abs, rel));
      continue;
    }

    const ext = path.extname(ent.name);
    if (!INCLUDE_EXT.has(ext)) continue;
    files.push({ rel, abs });
  }

  return files;
}

function countLines(absPath) {
  const buf = fs.readFileSync(absPath);
  // normalize: count \n, handle files without trailing newline
  const str = buf.toString('utf8');
  if (str.length === 0) return 0;
  const n = str.split('\n').length;
  return n;
}

function main() {
  const files = walk(ROOT, '');

  const hardViolations = [];
  const softWarnings = [];

  for (const f of files) {
    const relPosix = f.rel.replace(/\\/g, '/');
    if (ALLOWLIST.has(relPosix)) continue;

    const lines = countLines(f.abs);

    if (lines > hardLimit) {
      hardViolations.push({ file: relPosix, lines });
    } else if (lines > softLimit) {
      softWarnings.push({ file: relPosix, lines });
    }
  }

  if (softWarnings.length > 0) {
    console.log(`[godfile-check] SOFT warnings (>${softLimit} lines):`);
    for (const w of softWarnings.sort((a, b) => b.lines - a.lines).slice(0, 30)) {
      console.log(`- ${w.file}: ${w.lines}`);
    }
  }

  if (hardViolations.length > 0) {
    console.error(`[godfile-check] HARD FAIL (>${hardLimit} lines):`);
    for (const v of hardViolations.sort((a, b) => b.lines - a.lines)) {
      console.error(`- ${v.file}: ${v.lines}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[godfile-check] OK (soft>${softLimit}, hard>${hardLimit}).`);
}

main();
