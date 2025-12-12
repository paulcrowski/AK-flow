# Shadow Agent Testing Protocol (Brudnopis 12/10)

## Overview
The Shadow Agent framework allows running "Headless" cognitive loops against the **REAL Production Database** without polluting the main agent's memory or affecting production metrics.

## Architecture
- **ShadowFactory**: Generates unique `shadow-tester-{uuid}` agent IDs.
- **ShadowLoop**: Invokes `EventLoop.runSingleStep` directly, bypassing React/Frontend.
- **Mock Cortex**: Mocks the LLM (Gemini) to ensure deterministic outputs ("Warsaw") and avoid token costs.
- **Real Supabase**: Connects to the actual Supabase instance to verify Table logic, Triggers, and Constraints.

## Prerequisite: Environment Configuration
To run E2E tests successfully, you must bypass Row Level Security (RLS) or have an authenticated user.
The standard `anon` key often fails to insert into `memories` if RLS policies require `auth.uid() = agent_id`.

### Setup
1. Open `.env.local`
2. Ensure `SUPABASE_URL` is set.
3. Ensure `SUPABASE_KEY` is set to a **SERVICE_ROLE** key (if RLS is strict) or ensure your RLS policies allow `anon` inserts for `agent_id` starting with `shadow-tester-`.

## Running Tests
```bash
npm test -- __tests__/e2e/ShadowLoop.test.ts
```

## Cleanup
The `ShadowFactory` automatically calls `nuke()` after each test to delete all data associated with the temporary Agent ID.
