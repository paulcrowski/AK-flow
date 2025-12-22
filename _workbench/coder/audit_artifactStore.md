# audit_artifactStore

## BEFORE (call-sites snapshot)

### store.get
- utils/toolParser.ts:149 :: handlePublishArtifact -> store.get(resolvedId) [id]
- utils/toolParser.ts:208 :: handleArtifactBlock (CREATE) -> store.get(id) [id]
- utils/toolParser.ts:258 :: handleReadArtifact -> store.get(resolved.id) [id]
- core/systems/eventloop/ReactiveStep.ts (pre-change) :: Action-First READ -> store.get(c) [id only when c startsWith art-]

### store.append
- utils/toolParser.ts:224 :: handleArtifactBlock (APPEND) -> store.append(id) [id]
- core/systems/eventloop/ReactiveStep.ts (pre-change) :: Action-First APPEND -> store.append(c or byName[0].id) [id or id resolved by name]

### store.replace
- utils/toolParser.ts:230 :: handleArtifactBlock (REPLACE) -> store.replace(id) [id]
- core/systems/eventloop/ReactiveStep.ts (pre-change) :: Action-First REPLACE -> store.replace(c or byName[0].id) [id or id resolved by name]

### publish (PUBLISH tool/tag)
- utils/toolParser.ts:129 :: handlePublishArtifact -> TOOL_INTENT/TOOL_RESULT/TOOL_ERROR via eventBus.publish
- utils/toolParser.ts:270-273 :: [PUBLISH: ...] tag detection and dispatch

### parser tags (artifact)
- utils/toolParser.ts:277-280 :: [READ_ARTIFACT: ...] tag detection and dispatch
- utils/toolParser.ts:284-291 :: single-line [APPEND]/[REPLACE] tag detection and dispatch
- utils/toolParser.ts:295-318 :: block [CREATE]/[APPEND]/[REPLACE] tag detection and dispatch

## AFTER (post-change)

### store.get
- utils/toolParser.ts:149 :: handlePublishArtifact -> store.get(resolvedId) [id]
- utils/toolParser.ts:208 :: handleArtifactBlock (CREATE) -> store.get(id) [id]
- utils/toolParser.ts:258 :: handleReadArtifact -> store.get(resolved.id) [id]
- core/systems/eventloop/ReactiveStep.ts:225 :: Action-First READ -> store.get(resolved.id) [id via normalizeArtifactRef]

### store.append
- utils/toolParser.ts:224 :: handleArtifactBlock (APPEND) -> store.append(id) [id]
- core/systems/eventloop/ReactiveStep.ts:252 :: Action-First APPEND -> store.append(resolved.id) [id via normalizeArtifactRef]

### store.replace
- utils/toolParser.ts:230 :: handleArtifactBlock (REPLACE) -> store.replace(id) [id]
- core/systems/eventloop/ReactiveStep.ts:277 :: Action-First REPLACE -> store.replace(resolved.id) [id via normalizeArtifactRef]

### publish (PUBLISH tool/tag)
- utils/toolParser.ts:129 :: handlePublishArtifact -> TOOL_INTENT/TOOL_RESULT/TOOL_ERROR via eventBus.publish
- utils/toolParser.ts:270-273 :: [PUBLISH: ...] tag detection and dispatch
- core/systems/eventloop/ReactiveStep.ts:162 :: Action-First CREATE/READ_ARTIFACT/APPEND/REPLACE emit TOOL_INTENT + TOOL_RESULT/TOOL_ERROR

### parser tags (artifact)
- utils/toolParser.ts:277-280 :: [READ_ARTIFACT: ...] tag detection and dispatch
- utils/toolParser.ts:284-291 :: single-line [APPEND]/[REPLACE] tag detection and dispatch
- utils/toolParser.ts:295-318 :: block [CREATE]/[APPEND]/[REPLACE] tag detection and dispatch

## Notes
- normalizeArtifactRef is the sole gateway for Action-First read/append/replace ID resolution (core/systems/eventloop/ReactiveStep.ts:155).
- Artifact resolve metrics (artifactResolveAttempt/Success/Fail) are emitted on Action-First resolve paths (core/systems/eventloop/ReactiveStep.ts:152-159).
