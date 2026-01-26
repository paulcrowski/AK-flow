"before completing any task, run these checks:
- scan for hardcoded secrets, API keys, passwords
- check for SQL injection, shell injection, path traversal
- verify all user inputs are validated
- run the test suite
- check for type errors"

claude reads this automatically every session. built-in security gate.



step 2: prompts that catch bugs

"write 20 unit tests designed to break this function"
claude knows where it cut corners. let it snitch on itself.

"find every security vulnerability in this file. think like a pentester." SQL injection, auth bypasses, privilege escalation, input validation gaps.

"generate 50 edge cases: null, empty strings, negative numbers, unicode, arrays with 100k items"
paste these into hypothesis for automated fuzzing.

"audit this entire codebase for leaked secrets"
API keys in comments, passwords in config files, tokens in error messages.

step 3: tools that plug directly into claude

github .com/anthropics/claude-code-action
add to your repo, claude reviews every PR automatically. catches stuff before it merges.

pip install claude-agent-sdk
batch test entire directories programmatically. loop through files, pipe each one through claude's security audit.

factory .ai droids
run "droid" in terminal. scans your whole repo, opens PRs with fixes. connects to github, jira, sentry.

step 4: stack these automated scanners

semgrep scan (SAST - catches OWASP top 10)
bandit -r . (python security)
ruff check . --fix (linting + auto-fix)
mypy . --strict (type errors)
snyk test (dependency CVEs)
gitleaks detect (leaked secrets)

step 5: pre-commit hooks

pip install pre-commit
add all the above to .pre-commit-config.yaml
now you physically can't commit vulnerable code.

the loop:

claude writes code → CLAUDE md forces self-review → automated scanners catch the rest → pre-commit blocks garbage → github action reviews the PR
