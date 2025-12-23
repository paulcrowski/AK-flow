# Dead Code Triage

Goal: stop deleting by hunch. Every candidate gets a callsite audit.

Rules:
- KEEP: at least one callsite in `src/**` (including lazy imports in tools).
- QUARANTINE: no callsite, but historical/reference value.
- DELETE: no callsite + no reference value + causes confusion.

Fields:
- Candidate: file or symbol
- Purpose: why it exists
- Callsite: exact path(s) or "none"
- Flags: feature flag or runtime condition
- Decision: KEEP / QUARANTINE / DELETE
- Notes: follow-ups

| Candidate | Purpose | Callsite | Flags | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
