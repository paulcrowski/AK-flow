import { isMainFeatureEnabled } from '../../config/featureFlags';
import { CortexService } from '../../../llm/gemini';
import { TickCommitter } from '../TickCommitter';
import { LimbicSystem } from '../LimbicSystem';
import { CortexSystem } from '../CortexSystem';
import { ExecutiveGate } from '../ExecutiveGate';
import { useArtifactStore, normalizeArtifactRef } from '../../../stores/artifactStore';
import { SYSTEM_CONFIG } from '../../config/systemConfig';
import { getCurrentTraceId } from '../../trace/TraceContext';
import { p0MetricAdd } from '../TickLifecycleTelemetry';
import { eventBus } from '../../EventBus';
import { AgentType, PacketType } from '../../../types';
import { generateUUID } from '../../../utils/uuid';
import { detectIntent, getRetrievalLimit } from '../IntentDetector';
import { getRememberedArtifactName, rememberArtifactName } from '../../utils/artifactNameCache';
import { buildToolCommitDetails, formatToolCommitMessage } from '../../utils/toolCommit';

// P0.1 COMMIT 3: Action-First Policy
// Feature flag - can be disabled if causing issues
const ACTION_FIRST_ENABLED = (SYSTEM_CONFIG.features as Record<string, boolean>).P011_ACTION_FIRST_ENABLED ?? true;

type ActionFirstResult = {
  handled: boolean;
  action?: 'CREATE' | 'READ' | 'APPEND' | 'REPLACE';
  target?: string;
  payload?: string;
  assumption?: string;
};

function publishReactiveSpeech(params: {
  ctx: any;
  trace: TraceLike;
  callbacks: ReactiveCallbacksLike;
  speechText: string;
  internalThought: string;
  meta?: { knowledgeSource?: any; evidenceSource?: any; evidenceDetail?: any; generator?: any };
  agentMemoryId?: string | null;
}): void {
  const { ctx, trace, callbacks, speechText, internalThought, meta, agentMemoryId } = params;
  const candidate = ExecutiveGate.createReactiveCandidate(speechText, internalThought, `reactive-${trace.traceId}-${trace.tickNumber}`);
  const gateContext = {
    ...ExecutiveGate.getDefaultContext(ctx.limbic, 0),
    socialDynamics: ctx.socialDynamics
  };
  const gateDecision = ExecutiveGate.decide([candidate], gateContext);

  if (!gateDecision.should_speak || !gateDecision.winner) {
    callbacks.onThought(`[REACTIVE_SUPPRESSED] ${gateDecision.reason}`);
    return;
  }

  if (isMainFeatureEnabled('ONE_MIND_ENABLED') && trace.agentId) {
    try {
      const commit = TickCommitter.commitSpeech({
        agentId: trace.agentId,
        traceId: trace.traceId,
        tickNumber: trace.tickNumber,
        origin: 'reactive',
        speechText: gateDecision.winner.speech_content
      });

      if (commit.committed) {
        callbacks.onMessage('assistant', gateDecision.winner.speech_content, 'speech', {
          ...(meta || {}),
          ...(agentMemoryId ? { agentMemoryId } : {})
        });
      } else {
        callbacks.onThought(`[REACTIVE_SUPPRESSED] ${commit.blockReason || 'UNKNOWN'}`);
      }
      return;
    } catch (e) {
      callbacks.onThought(`[REACTIVE_COMMIT_ERROR] ${(e as Error)?.message || 'unknown'}`);
    }
  }

  callbacks.onMessage('assistant', gateDecision.winner.speech_content, 'speech', meta);
}

function updateContextAfterAction(ctx: any): void {
  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;
  ctx.consecutiveAgentSpeeches = 0;
  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}

function splitTargetAndPayload(input: string): { target: string; payload: string } {
  const idx = input.indexOf(':');
  if (idx < 0) return { target: input.trim(), payload: '' };
  return {
    target: input.slice(0, idx).trim(),
    payload: input.slice(idx + 1).trim()
  };
}

type IntentInput = {
  raw: string;
  trimmed: string;
  normalized: string;
};

// FIX-2: Multilingual verb patterns - Polish with diacritics + English
const CREATE_VERBS_PL = '(?:stworz|utworz|zapisz|tw[o\\u00f3]rz|utw[o\\u00f3]rz|stw[o\\u00f3]rz)';
const CREATE_VERBS_EN = '(?:create|make|write|save)';
const CREATE_VERBS = `(?:${CREATE_VERBS_PL}|${CREATE_VERBS_EN})`;

const APPEND_VERBS_PL = '(?:dopisz|dodaj|do\\u0142\\u0105cz|dolacz)';
const APPEND_VERBS_EN = '(?:append|add)';
const APPEND_VERBS = `(?:${APPEND_VERBS_PL}|${APPEND_VERBS_EN})`;

const EDIT_VERBS_PL = '(?:edytuj|eydtuj|modyfikuj|zmien|zmie\\u0144)';
const EDIT_VERBS_EN = '(?:edit|modify|change)';
const EDIT_VERBS = `(?:${EDIT_VERBS_PL}|${EDIT_VERBS_EN})`;

const READ_VERBS_PL = '(?:pokaz|poka\\u017c|otw[o\\u00f3]rz|wyswietl|wy\\u015bwietl|przeczytaj)';
const READ_VERBS_EN = '(?:show|open|display|read)';
const READ_VERBS = `(?:${READ_VERBS_PL}|${READ_VERBS_EN})`;

const FILE_WORD = '(?:plik|file)';
const CONTENT_KEYWORD =
  '(?:trescia|tre(?:s|\\u015b)ci(?:a|\\u0105)|tekstem|zawartoscia|zawarto(?:s|\\u015b)ci(?:a|\\u0105)|content|text)';
const CONTENT_COLON_KEYWORD = '(?:tresc|tre(?:s|\\u015b)(?:c|\\u0107)|content)';

const CREATE_NO_NAME_COLON_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?${CONTENT_COLON_KEYWORD}\\s*:\\s*([\\s\\S]+)`,
  'i'
);
const CREATE_WITH_NAME_COLON_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(?:o\\s+nazwie\\s+|named\\s+)?(.+?)\\s+${CONTENT_COLON_KEYWORD}\\s*:\\s*([\\s\\S]+)`,
  'i'
);
const CREATE_NO_NAME_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?z\\s+${CONTENT_KEYWORD}\\s+([\\s\\S]+)`,
  'i'
);
const CREATE_WITH_NAME_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(?:o\\s+nazwie\\s+|named\\s+)?(.+?)\\s+z\\s+${CONTENT_KEYWORD}\\s+([\\s\\S]+)`,
  'i'
);
// FIX-2: Support "tworz plik X a w nim Y" / "create file X with Y"
const CREATE_WITH_CONTENT_REGEX = new RegExp(
  `${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(?:o\\s+nazwie\\s+|named\\s+)?(.+?)\\s+(?:a\\s+w\\s+nim|with|containing)\\s+([\\s\\S]+)`,
  'i'
);
const CREATE_SIMPLE_REGEX = new RegExp(`${CREATE_VERBS}\\s+(?:${FILE_WORD}\\s+)?(.+)`, 'i');

const EDIT_APPEND_REGEX = new RegExp(
  `${EDIT_VERBS}\\s+(?:${FILE_WORD}\\s+)?([^\\s:]+)\\s+${APPEND_VERBS}\\s+(?:tresc|tekst|content|text)?\\s*:?\\s*([\\s\\S]+)`,
  'i'
);
const APPEND_REGEX = new RegExp(`${APPEND_VERBS}\\s+(?:do|to)\\s+(.+)`, 'i');
const APPEND_INLINE_REGEX = new RegExp(
  `${APPEND_VERBS}\\s+(?:tresc|tekst|content|text)?\\s*(?:do|to)\\s+([^\\s:]+)\\s+([\\s\\S]+)`,
  'i'
);
const EDIT_REPLACE_REGEX = new RegExp(
  `${EDIT_VERBS}\\s+(?:${FILE_WORD}\\s+)?([^\\s:]+)\\s*:\\s*([\\s\\S]+)`,
  'i'
);
const REPLACE_REGEX = /(?:zamien|zamie\u0144|zastap|zast\u0105p|replace)\s+(?:w|w\s+pliku|in|in\s+file)\s+(.+)/i;
const READ_REGEX = new RegExp(`${READ_VERBS}\\s+([^\\s,]+)`, 'i');


function normalizeIntentInput(input: string): IntentInput {
  const raw = String(input || '');
  const trimmed = raw.trim();
  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return { raw, trimmed, normalized };
}

function shouldIgnoreActionIntent(input: IntentInput): boolean {
  return (
    input.raw.includes('?') ||
    input.normalized.startsWith('czy ') ||
    input.normalized.includes('umiesz') ||
    input.normalized.includes('mozesz') ||
    input.normalized.includes('potrafisz')
  );
}

function slugifyTarget(input: string): string {
  const raw = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^o\s+/, '')
    .replace(/[^a-z0-9]+/g, '-');
  const collapsed = raw.replace(/-+/g, '-').replace(/^-|-$/g, '');
  return collapsed.slice(0, 48);
}

function deriveCreateTarget(rawTarget: string, opts?: { preferPhrase?: boolean }): string {
  const t = String(rawTarget || '').trim();
  if (!t) return 'artifact.md';
  const preferPhrase = Boolean(opts?.preferPhrase);
  const first = t.split(/\s+/)[0];
  const looksLikeFilename = !preferPhrase && (first.includes('.') || first.length >= 3);
  if (looksLikeFilename && !first.includes('/') && !first.includes('\\')) {
    if (first.toLowerCase().endsWith('.md')) return first;
    if (first.includes('.')) return first;
    return `${first}.md`;
  }
  const slug = slugifyTarget(t);
  return `${slug || 'artifact'}.md`;
}

function detectCreateIntent(ctx: IntentInput): ActionFirstResult | null {
  const candidates = [
    { match: ctx.raw.match(CREATE_NO_NAME_COLON_REGEX), payloadIndex: 1, preferPhrase: true },
    { match: ctx.raw.match(CREATE_WITH_NAME_COLON_REGEX), nameIndex: 1, payloadIndex: 2 },
    { match: ctx.raw.match(CREATE_NO_NAME_REGEX), payloadIndex: 1, preferPhrase: true },
    { match: ctx.raw.match(CREATE_WITH_NAME_REGEX), nameIndex: 1, payloadIndex: 2 },
    // FIX-2: "tworz plik X a w nim Y" / "create file X with Y"
    { match: ctx.raw.match(CREATE_WITH_CONTENT_REGEX), nameIndex: 1, payloadIndex: 2 }
  ];

  for (const candidate of candidates) {
    if (!candidate.match) continue;
    const payload = String(candidate.match[candidate.payloadIndex] || '').trim();
    if (!payload) continue;
    const name = candidate.nameIndex ? String(candidate.match[candidate.nameIndex] || '').trim() : '';
    const preferPhrase = candidate.preferPhrase ?? !name;
    const target = deriveCreateTarget(name || payload, { preferPhrase });
    return { handled: true, action: 'CREATE', target, payload };
  }

  const createMatch = ctx.normalized.match(CREATE_SIMPLE_REGEX);
  if (createMatch) return { handled: true, action: 'CREATE', target: deriveCreateTarget(createMatch[1]) };
  return null;
}

function detectAppendIntent(ctx: IntentInput): ActionFirstResult | null {
  const editAppendMatch = ctx.raw.match(EDIT_APPEND_REGEX);
  if (editAppendMatch) {
    const target = String(editAppendMatch[1] || '').trim();
    const payload = String(editAppendMatch[2] || '').trim();
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }

  const appendMatch = ctx.normalized.match(APPEND_REGEX);
  if (appendMatch) {
    const { target, payload } = splitTargetAndPayload(String(appendMatch[1] || ''));
    if (target && payload) return { handled: true, action: 'APPEND', target, payload };
  }

  const appendInlineMatch = ctx.raw.match(APPEND_INLINE_REGEX);
  if (appendInlineMatch) {
    const target = String(appendInlineMatch[1] || '').trim();
    const payload = String(appendInlineMatch[2] || '').trim();
    if (payload && (target.startsWith('art-') || target.includes('.'))) {
      return { handled: true, action: 'APPEND', target, payload };
    }
  }

  return null;
}

function detectReplaceIntent(ctx: IntentInput): ActionFirstResult | null {
  const editReplaceMatch = ctx.raw.match(EDIT_REPLACE_REGEX);
  if (editReplaceMatch) {
    const target = String(editReplaceMatch[1] || '').trim();
    const payload = String(editReplaceMatch[2] || '').trim();
    if (target && payload) return { handled: true, action: 'REPLACE', target, payload };
  }

  const replaceMatch = ctx.normalized.match(REPLACE_REGEX);
  if (replaceMatch) {
    const { target, payload } = splitTargetAndPayload(String(replaceMatch[1] || ''));
    if (target) return { handled: true, action: 'REPLACE', target, payload };
  }

  return null;
}

function detectReadIntent(ctx: IntentInput): ActionFirstResult | null {
  const readMatch = ctx.normalized.match(READ_REGEX);
  if (readMatch) return { handled: true, action: 'READ', target: readMatch[1] };
  return null;
}

function detectFileIntent(text: string): ActionFirstResult | null {
  const ctx = normalizeIntentInput(text);
  if (shouldIgnoreActionIntent(ctx)) return { handled: false };
  return detectCreateIntent(ctx) ?? detectAppendIntent(ctx) ?? detectReplaceIntent(ctx) ?? detectReadIntent(ctx);
}

function detectSearchIntent(_text: string): ActionFirstResult | null {
  return null;
}

function detectVisualizeIntent(_text: string): ActionFirstResult | null {
  return null;
}

function detectResearchIntent(_text: string): ActionFirstResult | null {
  return null;
}

function detectActionableIntent(input: string): ActionFirstResult {
  return (
    detectFileIntent(input) ??
    detectSearchIntent(input) ??
    detectVisualizeIntent(input) ??
    detectResearchIntent(input) ??
    { handled: false }
  );
}

export function detectActionableIntentForTesting(input: string): ActionFirstResult {
  return detectActionableIntent(input);
}

export type TraceLike = {
  traceId: string;
  tickNumber: number;
  agentId: string | null;
};

export type ReactiveCallbacksLike = {
  onMessage: (role: string, text: string, type: any, meta?: any) => void;
  onThought: (thought: string) => void;
  onLimbicUpdate: (limbic: any) => void;
};

export async function runReactiveStep(input: {
  ctx: any;
  userInput: string;
  callbacks: ReactiveCallbacksLike;
  memorySpace: any;
  trace: TraceLike;
}): Promise<void> {
  const { ctx, userInput, callbacks, memorySpace, trace } = input;

  TickCommitter.markUserInput();

  // P0.1: Action-First - execute tool commands immediately without asking
  if (ACTION_FIRST_ENABLED) {
    const actionIntent = detectActionableIntent(userInput);
    if (actionIntent.handled && actionIntent.action && actionIntent.target) {
      const store = useArtifactStore.getState();
      const target = actionIntent.target;

      const resolveRef = (refRaw: string) => {
        const traceId = getCurrentTraceId();
        if (traceId) p0MetricAdd(traceId, { artifactResolveAttempt: 1 });
        const resolved = normalizeArtifactRef(refRaw);
        if (traceId) {
          p0MetricAdd(traceId, resolved.ok ? { artifactResolveSuccess: 1 } : { artifactResolveFail: 1 });
        }
        return resolved;
      };

      const emitToolIntent = (tool: string, arg: string, artifactName?: string) => {
        const intentId = generateUUID();
        eventBus.publish({
          id: intentId,
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_INTENT,
          payload: { tool, arg, ...(artifactName ? { artifactName } : {}) },
          priority: 0.8
        });
        return intentId;
      };

      const emitToolResult = (tool: string, intentId: string, payload: Record<string, unknown>) => {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_RESULT,
          payload: { tool, intentId, ...payload },
          priority: 0.8
        });
      };

      const emitToolCommit = (params: {
        action: 'CREATE' | 'APPEND' | 'REPLACE';
        artifactId: string;
        artifactName: string;
        beforeContent?: string;
        afterContent?: string;
        deltaText?: string;
      }) => {
        const details = buildToolCommitDetails(params);
        if (!details) return;
        const message = formatToolCommitMessage(details);
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.SYSTEM_ALERT,
          payload: {
            event: 'TOOL_COMMIT',
            message,
            ...details
          },
          priority: 0.7
        });
      };

      const emitToolError = (tool: string, intentId: string, payload: Record<string, unknown>, error: string) => {
        eventBus.publish({
          id: generateUUID(),
          timestamp: Date.now(),
          source: AgentType.CORTEX_FLOW,
          type: PacketType.TOOL_ERROR,
          payload: { tool, intentId, ...payload, error },
          priority: 0.9
        });
      };

      try {
        if (actionIntent.action === 'CREATE') {
          const intentId = emitToolIntent('CREATE', target, target);
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'CREATE' });
          try {
            let content = String(actionIntent.payload || '').trim();
            // FIX-1: Fallback dla pustego payload — generuj placeholder zamiast pustego pliku
            if (!content) {
              content = `# ${target}\n\nTODO: Uzupełnić treść\n\nCreated: ${new Date().toISOString().split('T')[0]}`;
              if (traceId) p0MetricAdd(traceId, { actionFirstPayloadFallback: 1 });
            }
            const id = store.create(target, content);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1, actionFirstContentChars: content.length });
            const created = store.get(id);
            const artifactName = rememberArtifactName(id, created?.name || target) || target;
            emitToolResult('CREATE', intentId, { id, name: artifactName });
            emitToolCommit({
              action: 'CREATE',
              artifactId: id,
              artifactName,
              afterContent: created?.content ?? content
            });
            callbacks.onMessage('assistant', `Utworzylem ${target} (${id}). Poprawic cos?`, 'speech');
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError('CREATE', intentId, { arg: target }, (e as Error)?.message || 'unknown');
            return;
          }
        }

        if (actionIntent.action === 'READ') {
          const resolved = resolveRef(target);
          const nameHint = resolved.ok
            ? rememberArtifactName(resolved.id, resolved.nameHint || getRememberedArtifactName(resolved.id) || '')
            : '';
          const intentId = emitToolIntent('READ_ARTIFACT', resolved.ok ? resolved.id : target, nameHint || undefined);
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'READ' });
          if (!resolved.ok) {
            emitToolError('READ_ARTIFACT', intentId, { arg: target }, resolved.userMessage);
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          const art = store.get(resolved.id);
          if (!art) {
            emitToolError('READ_ARTIFACT', intentId, { arg: resolved.id }, 'ARTIFACT_NOT_FOUND');
            return;
          }
          if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
          emitToolResult('READ_ARTIFACT', intentId, { id: art.id, name: art.name, length: art.content.length });
          publishReactiveSpeech({ ctx, trace, callbacks, speechText: `${art.name}\n\n${art.content || '(pusty)'}`, internalThought: '' });
          updateContextAfterAction(ctx);
          return;
        }

        if (actionIntent.action === 'APPEND') {
          const payload = String(actionIntent.payload || '').trim();
          const resolved = resolveRef(target);
          const nameHint = resolved.ok
            ? rememberArtifactName(resolved.id, resolved.nameHint || getRememberedArtifactName(resolved.id) || '')
            : '';
          const traceId = getCurrentTraceId();

          // FIX-6 Variant C: If no payload, add placeholder AND ask for content
          if (!payload) {
            if (!resolved.ok) {
              publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: 'APPEND_TARGET_NOT_FOUND' });
              return;
            }

            // Generate placeholder content
            const placeholderContent = `\n\n<!-- TODO: Uzupełnić / TODO: Add content -->\n<!-- Added: ${new Date().toISOString().split('T')[0]} -->`;
            const intentId = emitToolIntent('APPEND', resolved.id, nameHint || undefined);
            if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'APPEND', appendPayloadMissing: 1 });

            try {
              const before = store.get(resolved.id)?.content ?? '';
              store.append(resolved.id, placeholderContent);
              if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
              const updated = store.get(resolved.id);
              const artifactName = rememberArtifactName(
                resolved.id,
                updated?.name || resolved.nameHint || getRememberedArtifactName(resolved.id) || ''
              ) || resolved.nameHint || resolved.id;
              emitToolResult('APPEND', intentId, { id: resolved.id, name: artifactName, placeholder: true });
              emitToolCommit({
                action: 'APPEND',
                artifactId: resolved.id,
                artifactName,
                beforeContent: before,
                afterContent: updated?.content ?? ''
              });

              // Ask user for actual content (multilingual)
              const isPolish = ctx.agentIdentity?.language?.toLowerCase().includes('pol') ||
                ctx.agentIdentity?.language?.toLowerCase() === 'pl';
              const askMessage = isPolish
                ? `Dodałem placeholder do ${artifactName}. Co chcesz tam wpisać?`
                : `Added placeholder to ${artifactName}. What content should I add?`;

              publishReactiveSpeech({
                ctx,
                trace,
                callbacks,
                speechText: askMessage,
                internalThought: 'APPEND_NEEDS_CONTENT'
              });
              updateContextAfterAction(ctx);
              return;
            } catch (e) {
              emitToolError('APPEND', intentId, { arg: resolved.id }, (e as Error)?.message || 'unknown');
              return;
            }
          }

          // Normal flow with payload
          const intentId = emitToolIntent('APPEND', resolved.ok ? resolved.id : target, nameHint || undefined);
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'APPEND' });
          if (!resolved.ok) {
            emitToolError('APPEND', intentId, { arg: target }, resolved.userMessage);
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          try {
            const before = store.get(resolved.id)?.content ?? '';
            store.append(resolved.id, `\n\n${payload}`);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            const updated = store.get(resolved.id);
            const artifactName = rememberArtifactName(
              resolved.id,
              updated?.name || resolved.nameHint || getRememberedArtifactName(resolved.id) || ''
            ) || resolved.nameHint || resolved.id;
            emitToolResult('APPEND', intentId, { id: resolved.id, name: artifactName });
            emitToolCommit({
              action: 'APPEND',
              artifactId: resolved.id,
              artifactName,
              beforeContent: before,
              afterContent: updated?.content ?? ''
            });
            store.markComplete(resolved.id, true);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: `Dopisałem do ${resolved.nameHint || resolved.id}. Poprawić coś?`,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError('APPEND', intentId, { arg: resolved.id }, (e as Error)?.message || 'unknown');
            return;
          }
        }

        if (actionIntent.action === 'REPLACE') {
          const resolved = resolveRef(target);
          const next = String(actionIntent.payload || '').trim() || `TODO: REPLACE requested\n\n${userInput}`;
          const nameHint = resolved.ok
            ? rememberArtifactName(resolved.id, resolved.nameHint || getRememberedArtifactName(resolved.id) || '')
            : '';
          const intentId = emitToolIntent('REPLACE', resolved.ok ? resolved.id : target, nameHint || undefined);
          const traceId = getCurrentTraceId();
          if (traceId) p0MetricAdd(traceId, { actionFirstTriggered: 1, actionType: 'REPLACE' });
          if (!resolved.ok) {
            emitToolError('REPLACE', intentId, { arg: target }, resolved.userMessage);
            publishReactiveSpeech({ ctx, trace, callbacks, speechText: resolved.userMessage, internalThought: '' });
            return;
          }
          try {
            const before = store.get(resolved.id)?.content ?? '';
            store.replace(resolved.id, next);
            if (traceId) p0MetricAdd(traceId, { actionFirstExecuted: 1 });
            const updated = store.get(resolved.id);
            const artifactName = rememberArtifactName(
              resolved.id,
              updated?.name || resolved.nameHint || getRememberedArtifactName(resolved.id) || ''
            ) || resolved.nameHint || resolved.id;
            emitToolResult('REPLACE', intentId, { id: resolved.id, name: artifactName });
            emitToolCommit({
              action: 'REPLACE',
              artifactId: resolved.id,
              artifactName,
              beforeContent: before,
              afterContent: updated?.content ?? ''
            });
            store.markComplete(resolved.id, true);
            publishReactiveSpeech({
              ctx,
              trace,
              callbacks,
              speechText: `Podmieni?,em tre?>?? w ${resolved.nameHint || resolved.id}. Poprawi?? co?>?`,
              internalThought: ''
            });
            updateContextAfterAction(ctx);
            return;
          } catch (e) {
            emitToolError('REPLACE', intentId, { arg: resolved.id }, (e as Error)?.message || 'unknown');
            return;
          }
        }
      } catch (e) {
        // Action failed, fall through to normal processing
        callbacks.onThought(`[ACTION_FIRST_ERROR] ${(e as Error)?.message || 'unknown'}`);
      }
    }
  }

  const prefetchedMemories = isMainFeatureEnabled('ONE_MIND_ENABLED')
    ? ((await memorySpace.hot.semanticSearch(userInput, {
      limit: getRetrievalLimit(detectIntent(userInput))
    })) as any)
    : undefined;

  const result = await CortexSystem.processUserMessage({
    text: userInput,
    currentLimbic: ctx.limbic,
    currentSoma: ctx.soma,
    conversationHistory: ctx.conversation,
    identity: ctx.agentIdentity,
    sessionOverlay: ctx.sessionOverlay,
    memorySpace,
    prefetchedMemories
  });

  const intent = await CortexService.detectIntent(userInput);

  if (intent.style === 'POETIC') {
    ctx.poeticMode = true;
    console.log('Intent Detected: POETIC MODE ENABLED');
  } else if (intent.style === 'SIMPLE') {
    ctx.poeticMode = false;
    console.log('Intent Detected: POETIC MODE DISABLED (Simple Style Requested)');
  } else if (intent.style === 'ACADEMIC') {
    ctx.poeticMode = false;
  }

  if (result.moodShift) {
    ctx.limbic = LimbicSystem.applyMoodShift(ctx.limbic, result.moodShift);
    callbacks.onLimbicUpdate(ctx.limbic);
  }

  if (result.internalThought) {
    callbacks.onMessage('assistant', result.internalThought, 'thought');
  }

  publishReactiveSpeech({
    ctx,
    trace,
    callbacks,
    speechText: result.responseText,
    internalThought: result.internalThought || '',
    meta: {
      knowledgeSource: result.knowledgeSource,
      evidenceSource: result.evidenceSource,
      evidenceDetail: result.evidenceDetail,
      generator: result.generator
    },
    agentMemoryId: result.agentMemoryId
  });

  const now = Date.now();
  ctx.silenceStart = now;
  ctx.lastSpeakTimestamp = now;
  ctx.goalState.lastUserInteractionAt = now;

  ctx.consecutiveAgentSpeeches = 0;

  ctx.hadExternalRewardThisTick = true;
  ctx.ticksSinceLastReward = 0;
}

