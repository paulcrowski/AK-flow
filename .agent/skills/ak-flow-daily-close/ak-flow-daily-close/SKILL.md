---
name: ak-flow-daily-close
description: End-of-day close for AK-Flow. Use when asked to do daily close/zamkniecie dnia, close session, or to update daily log + manifest + architecture + challenges + ak-nexus state. Applies the procedure from docs/PROCEDURES.md and updates the exact files without renaming.
---

# AK Flow Daily Close

## Overview

Perform the daily close workflow and update the required docs/state files exactly as specified by the project procedure.

## Workflow

1) Read the canonical procedure
- Open `docs/PROCEDURES.md`, section "Procedura Zamkniecia Dnia".
- Follow its checklist and templates. Do not invent new file names.

2) Gather inputs
- Date (YYYY-MM-DD).
- Commits and key changes.
- Test/build status (only if actually run).
- Manual UI checks (only if actually done).
- Remaining TODOs for "Next".

3) Update daily log
- File: `docs/daily logs/YYYY-MM-DD.md`.
- Append: Summary, Verification, Next (match existing formatting).
- If tests/build not rerun, say "not rerun" explicitly.

4) Update system manifest
- File: `docs/SYSTEM_MANIFEST.md`.
- Add new "What's New" section for the date.
- Update "System Version" and "Last Updated" if appropriate.
- Preserve all older sections.

5) Update architecture map
- File: `docs/architecture/ARCHITECTURE_MAP.md`.
- Add a new "FAZA" section with date and short mechanics summary.
- Update version line at top.

6) Update challenges (only if new/closed issue)
- File: `docs/engineering/CHALLENGES.md`.
- Add a new Problem section or mark resolution.
- Update stats if a new problem is added.

7) Update ak-nexus state
- File: `ak-nexus/data/ak-flow-state.json`.
- Update `lastUpdated`, `lastModified`, `modifiedBy`.
- Append a note with tag `daily_close`.
- Update `stats.testsTotal/testsPassing` only if known.
- Keep valid JSON (2-space indent).

8) Optional: agi tests checklist
- File: `docs/agi_tests.md`.
- Mark PASS/FAIL only with real evidence.

9) Commit
- One commit for daily close docs/state (e.g., `docs: daily close YYYY-MM-DD`).
- Do not rename files. Keep paths exact.

## References

- See `references/day-close-files.md` for the target file list and prompts.
