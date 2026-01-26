import { AgentType, PacketType } from '../../types';
import type { PendingAction } from '../systems/eventloop/pending';

export type KernelRunnerInput = {
  clientMessageId: string;
  userInput: string;
  imageData?: string;
};

export type KernelEngineRunnerDeps<TIdentity> = {
  actions: {
    dispatch: (event: any) => void;
    tick: () => void;
    setIsProcessing: (processing: boolean) => void;
    setCurrentThought: (thought: string) => void;
    addUiMessage: (message: any) => void;
    setUiConversation: (messages: any[]) => void;
    processUserInput: (input: string) => void;
    hydrate: (state: any) => void;
    updateSocialDynamics: (payload: { agentSpoke?: boolean; userResponded?: boolean }) => void;
    setPendingAction: (action: PendingAction | null) => void;
  };

  getState: () => any;

  generateUUID: () => string;

  getCurrentTraceId: () => string | null;

  processOutputForTools: (rawText: string) => Promise<string>;

  archiveMessage: (msg: any, agentId: string, sessionId: string) => void;
  upsertLocalSessionSummary: (sessionId: string, preview: string, timestamp: number) => void;

  publishEvent: (packet: any) => void;

  runEventLoopStep: (ctx: any, input: string | null, callbacks: any) => Promise<any>;

  getAutonomyConfig: () => { exploreMinSilenceSec: number };
  computeTickIntervalMs: (energy: number) => number;

  getIdentity: () => TIdentity | null | undefined;
  getAgentId: () => string | null;
  getSessionId: () => string | null;

  logPhysiologySnapshot: (context: string) => void;

  setSystemError: (e: unknown) => void;
};

export class KernelEngineRunner<TIdentity> {
  private deps: KernelEngineRunnerDeps<TIdentity>;
  private timeoutRef: ReturnType<typeof setTimeout> | null = null;
  private isLoopRunning = false;

  private inputQueue: KernelRunnerInput[] = [];
  private drainingQueue = false;
  private lastEnqueue: { text: string; at: number } | null = null;

  constructor(deps: KernelEngineRunnerDeps<TIdentity>) {
    this.deps = deps;
  }

  private isUserFacingError(text: string): boolean {
    const normalized = String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    // FIX-7: Extended error detection - Polish and English
    return normalized.includes('wystapil problem')
      || normalized.includes('blad')
      || normalized.includes('error')
      || normalized.includes('nie udalo sie')
      || normalized.includes('nie mozna')
      || normalized.includes('failed')
      || normalized.includes('unable to');
  }

  private maybeEmitUiErrorToast(messageId: string, text: string): void {
    if (!this.isUserFacingError(text)) return;
    this.deps.publishEvent({
      id: this.deps.generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.SYSTEM_ALERT,
      payload: {
        event: 'UI_ERROR_TOAST',
        code: 'CORTEX_FALLBACK',
        source: 'assistant',
        messageId
      },
      priority: 0.6
    });
  }

  setDeps(deps: KernelEngineRunnerDeps<TIdentity>) {
    this.deps = deps;
  }

  stopAutonomyLoop() {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
    this.isLoopRunning = false;
  }

  startAutonomyLoop() {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    const runTick = async () => {
      if (!this.isLoopRunning) return;

      try {
        this.deps.actions.tick();

        const state = this.deps.getState();
        const energy = state.soma.energy;
        const baseInterval = this.deps.computeTickIntervalMs(energy);
        const autonomyCfg = this.deps.getAutonomyConfig();
        const silenceSec = (Date.now() - (state.silenceStart || Date.now())) / 1000;

        if (!state.soma.isSleeping && !state.isProcessing) {
          if (silenceSec < autonomyCfg.exploreMinSilenceSec) {
            this.timeoutRef = setTimeout(runTick, Math.max(3000, baseInterval));
            return;
          }

          const ctx = this.buildLoopContext({ autonomousMode: true });
          let nextCtx = ctx;

          try {
            const silenceWindow = autonomyCfg.exploreMinSilenceSec;
            if (silenceSec < silenceWindow) {
              this.timeoutRef = setTimeout(runTick, Math.max(3000, baseInterval));
              return;
            }

            nextCtx = await this.deps.runEventLoopStep(ctx, null, {
              onMessage: (role: string, text: string, type: any, meta?: any) => {
                if (role === 'assistant' && type === 'speech') {
                  void this.handleAssistantSpeechAutonomous(text, type, meta);
                } else if (role === 'assistant' && type === 'thought') {
                  this.deps.actions.setCurrentThought(text);
                } else if (role === 'assistant' && (type === 'intel' || type === 'tool_result')) {
                  this.handleAssistantInfoMessage(text, type, meta);
                }
              },
              onThought: (thought: string) => {
                this.deps.actions.setCurrentThought(thought);
              },
              onSomaUpdate: (soma: any) => this.deps.actions.hydrate({ soma }),
              onLimbicUpdate: (limbic: any) => this.deps.actions.hydrate({ limbic })
            });
          } finally {
            this.syncLoopContextToStore(nextCtx);
          }
        }

        this.timeoutRef = setTimeout(runTick, baseInterval);
      } catch (error) {
        this.deps.setSystemError(error);
      }
    };

    void runTick();
  }

  enqueueUserInput(userInput: string, imageData?: string) {
    const trimmed = (userInput || '').trim();
    if (!trimmed) return;

    const now = Date.now();
    const last = this.lastEnqueue;
    if (last && last.text === trimmed && now - last.at < 600) return;
    this.lastEnqueue = { text: trimmed, at: now };

    const clientMessageId = this.deps.generateUUID();
    const inputMsg = {
      id: clientMessageId,
      role: 'user',
      text: trimmed,
      ...(imageData ? { imageData } : {})
    };

    this.deps.actions.addUiMessage(inputMsg as any);

    this.inputQueue.push({ clientMessageId, userInput: trimmed, imageData });
    void this.drainInputQueue();
  }

  private async drainInputQueue() {
    if (this.drainingQueue) return;
    this.drainingQueue = true;
    this.deps.actions.setIsProcessing(true);

    try {
      while (this.inputQueue.length > 0) {
        const next = this.inputQueue.shift();
        if (!next) break;
        await this.processSingleInput(next.clientMessageId, next.userInput, next.imageData);
      }
    } catch (error) {
      this.inputQueue = [];
      this.deps.setSystemError(error);
    } finally {
      this.deps.actions.setIsProcessing(false);
      this.drainingQueue = false;
    }
  }

  private async processSingleInput(clientMessageId: string, userInput: string, imageData?: string) {
    this.deps.actions.hydrate({ silenceStart: Date.now() });

    const processedUserInput = await this.deps.processOutputForTools(userInput);

    const prev = this.deps.getState().uiConversation;
    const idx = prev.findIndex((m: any) => m?.id === clientMessageId);

    let nextConv: any[];
    if (idx !== -1) {
      const updated = {
        ...prev[idx],
        role: 'user',
        text: processedUserInput,
        ...(imageData ? { imageData } : {})
      };
      nextConv = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
    } else {
      nextConv = [
        ...prev,
        {
          id: clientMessageId,
          role: 'user',
          text: processedUserInput,
          ...(imageData ? { imageData } : {})
        }
      ];
    }

    this.deps.actions.setUiConversation(nextConv as any);

    const agentId = this.deps.getAgentId();
    const sessId = this.deps.getSessionId();
    if (agentId && sessId) {
      const nowTs = Date.now();
      this.deps.archiveMessage(
        {
          id: clientMessageId,
          role: 'user',
          content: processedUserInput,
          timestamp: nowTs,
          metadata: { hasImage: !!imageData }
        },
        agentId,
        sessId
      );

      this.deps.upsertLocalSessionSummary(sessId, processedUserInput, nowTs);
    }

    this.deps.publishEvent({
      id: this.deps.generateUUID(),
      timestamp: Date.now(),
      source: AgentType.CORTEX_FLOW,
      type: PacketType.THOUGHT_CANDIDATE,
      payload: { event: 'USER_INPUT', text: processedUserInput, hasImage: !!imageData },
      priority: 0.8
    });

    this.deps.actions.processUserInput(processedUserInput);

    const ctx = this.buildLoopContext({
      autonomousMode: false,
      conversationOverride: [
        ...nextConv.map((c: any) => ({
          role: c.role as 'user' | 'assistant',
          text: c.text,
          type: c.type
        })),
        { role: 'user', text: processedUserInput }
      ]
    });

    let nextCtx = ctx;
    try {
      nextCtx = await this.deps.runEventLoopStep(ctx, processedUserInput, {
        onMessage: (role: string, text: string, type: any, meta?: any) => {
          if (role === 'assistant' && type === 'speech') {
            void this.handleAssistantSpeechReactive(text, type, meta);
          } else if (role === 'assistant' && type === 'thought') {
            this.deps.actions.setCurrentThought(text);
          } else if (role === 'assistant' && (type === 'intel' || type === 'tool_result')) {
            this.handleAssistantInfoMessage(text, type, meta);
          }
        },
        onThought: (thought: string) => {
          this.deps.actions.setCurrentThought(thought);
        },
        onSomaUpdate: (soma: any) => this.deps.actions.hydrate({ soma }),
        onLimbicUpdate: (limbic: any) => this.deps.actions.hydrate({ limbic })
      });
    } finally {
      this.syncLoopContextToStore(nextCtx);
    }
  }

  private buildLoopContext(opts: { autonomousMode: boolean; conversationOverride?: any[] }) {
    const state = this.deps.getState();
    const identity = this.deps.getIdentity();
    const baseConversation = opts.conversationOverride
      ? opts.conversationOverride
      : state.uiConversation.map((c: any) => ({
        role: c.role as 'user' | 'assistant',
        text: c.text,
        type: c.type
      }));

    return {
      soma: state.soma,
      limbic: state.limbic,
      neuro: state.neuro,
      conversation: baseConversation,
      lastLibraryDocId: state.lastLibraryDocId ?? null,
      lastLibraryDocName: state.lastLibraryDocName ?? null,
      lastLibraryDocChunkCount: state.lastLibraryDocChunkCount ?? null,
      focus: state.focus,
      cursor: state.cursor,
      lastWorldPath: state.lastWorldPath ?? null,
      lastArtifactId: state.lastArtifactId ?? null,
      lastArtifactName: state.lastArtifactName ?? null,
      activeDomain: state.activeDomain ?? null,
      lastTool: state.lastTool ?? null,
      autonomousMode: opts.autonomousMode,
      lastSpeakTimestamp: state.lastSpeakTimestamp,
      silenceStart: state.silenceStart,
      thoughtHistory: state.thoughtHistory,
      poeticMode: state.poeticMode,
      autonomousLimitPerMinute: 3,
      chemistryEnabled: state.chemistryEnabled,
      goalState: state.goalState,
      traitVector: state.traitVector,
      consecutiveAgentSpeeches: state.consecutiveAgentSpeeches,
      ticksSinceLastReward: state.ticksSinceLastReward,
      hadExternalRewardThisTick: false,
      pendingAction: state.pendingAction ?? null,
      agentIdentity: identity
        ? {
          name: (identity as any).name,
          persona: (identity as any).persona || '',
          coreValues: (identity as any).core_values || [],
          traitVector: (identity as any).trait_vector,
          voiceStyle: (identity as any).voice_style || 'balanced',
          language: (identity as any).language || 'English',
          stylePrefs: (identity as any).style_prefs
        }
        : undefined,
      socialDynamics: state.socialDynamics,
      userStylePrefs: (identity as any)?.style_prefs || {}
    };
  }

  private syncLoopContextToStore(nextCtx: any) {
    if (!nextCtx || typeof nextCtx !== 'object') return;

    const patch: any = {};
    if (typeof nextCtx.silenceStart === 'number') patch.silenceStart = nextCtx.silenceStart;
    if (typeof nextCtx.lastSpeakTimestamp === 'number') patch.lastSpeakTimestamp = nextCtx.lastSpeakTimestamp;
    if (typeof nextCtx.consecutiveAgentSpeeches === 'number') patch.consecutiveAgentSpeeches = nextCtx.consecutiveAgentSpeeches;
    if (typeof nextCtx.ticksSinceLastReward === 'number') patch.ticksSinceLastReward = nextCtx.ticksSinceLastReward;
    if (Array.isArray(nextCtx.thoughtHistory)) patch.thoughtHistory = nextCtx.thoughtHistory;
    if ('lastLibraryDocId' in nextCtx) patch.lastLibraryDocId = nextCtx.lastLibraryDocId ?? null;
    if ('lastLibraryDocName' in nextCtx) patch.lastLibraryDocName = nextCtx.lastLibraryDocName ?? null;
    if ('lastLibraryDocChunkCount' in nextCtx) patch.lastLibraryDocChunkCount = nextCtx.lastLibraryDocChunkCount ?? null;
    if ('focus' in nextCtx) patch.focus = nextCtx.focus ?? { domain: null, id: null, label: null };
    if ('cursor' in nextCtx) patch.cursor = nextCtx.cursor ?? {};
    if ('lastWorldPath' in nextCtx) patch.lastWorldPath = nextCtx.lastWorldPath ?? null;
    if ('lastArtifactId' in nextCtx) patch.lastArtifactId = nextCtx.lastArtifactId ?? null;
    if ('lastArtifactName' in nextCtx) patch.lastArtifactName = nextCtx.lastArtifactName ?? null;
    if ('activeDomain' in nextCtx) patch.activeDomain = nextCtx.activeDomain ?? null;
    if ('lastTool' in nextCtx) patch.lastTool = nextCtx.lastTool ?? null;

    if (Object.keys(patch).length > 0) {
      this.deps.actions.hydrate(patch);
    }

    if ('pendingAction' in nextCtx) {
      this.deps.actions.setPendingAction(nextCtx.pendingAction ?? null);
    }
  }

  private async handleAssistantSpeechAutonomous(text: string, type: any, meta?: any) {
    try {
      const cleaned = await this.deps.processOutputForTools(text);
      if (!cleaned.trim()) return;
      const messageId = this.deps.generateUUID();
      const msg = {
        id: messageId,
        role: 'assistant',
        text: cleaned,
        type,
        ...(meta?.knowledgeSource ? { knowledgeSource: meta.knowledgeSource } : {})
      };

      this.deps.actions.addUiMessage(msg as any);
      this.maybeEmitUiErrorToast(messageId, cleaned);

      this.deps.actions.dispatch({
        type: 'AGENT_SPOKE',
        timestamp: Date.now(),
        payload: { text: cleaned, voicePressure: 0.5 }
      });

      this.deps.publishEvent({
        id: this.deps.generateUUID(),
        timestamp: Date.now(),
        source: AgentType.CORTEX_FLOW,
        type: PacketType.THOUGHT_CANDIDATE,
        payload: { event: 'AUTONOMOUS_SPOKE', speech_content: cleaned, agentName: (this.deps.getIdentity() as any)?.name || 'Unknown' },
        priority: 0.9
      });

      this.deps.actions.updateSocialDynamics({ agentSpoke: true });
      this.deps.logPhysiologySnapshot('AUTONOMOUS_RESPONSE');
    } catch (e) {
      const fallbackMsg = { role: 'assistant', text, type };
      this.deps.actions.addUiMessage(fallbackMsg as any);
    }
  }

  private handleAssistantInfoMessage(text: string, type: 'intel' | 'tool_result', meta?: any) {
    const cleaned = String(text ?? '');
    if (!cleaned.trim()) return;
    const messageId = this.deps.generateUUID();
    const msg = {
      id: messageId,
      role: 'assistant',
      text: cleaned,
      type,
      ...(meta?.sources ? { sources: meta.sources } : {}),
      ...(meta?.knowledgeSource ? { knowledgeSource: meta.knowledgeSource } : {}),
      ...(meta?.evidenceSource ? { evidenceSource: meta.evidenceSource } : {}),
      ...(meta?.evidenceDetail ? { evidenceDetail: meta.evidenceDetail } : {}),
      ...(meta?.generator ? { generator: meta.generator } : {}),
      ...(meta?.agentMemoryId ? { agentMemoryId: meta.agentMemoryId } : {})
    };

    this.deps.actions.addUiMessage(msg as any);
  }

  private async handleAssistantSpeechReactive(text: string, type: any, meta?: any) {
    try {
      // FIX-7: Check for error BEFORE processOutputForTools (original text)
      const rawMessageId = this.deps.generateUUID();
      if (this.isUserFacingError(text)) {
        this.maybeEmitUiErrorToast(rawMessageId, text);
      }

      const cleaned = await this.deps.processOutputForTools(text);
      const messageId = this.deps.generateUUID();
      const speechMsg = {
        id: messageId,
        role: 'assistant',
        text: cleaned,
        type,
        ...(meta?.knowledgeSource ? { knowledgeSource: meta.knowledgeSource } : {}),
        ...(meta?.evidenceSource ? { evidenceSource: meta.evidenceSource } : {}),
        ...(meta?.evidenceDetail ? { evidenceDetail: meta.evidenceDetail } : {}),
        ...(meta?.generator ? { generator: meta.generator } : {}),
        ...(meta?.agentMemoryId ? { agentMemoryId: meta.agentMemoryId } : {})
      };

      this.deps.actions.addUiMessage(speechMsg as any);
      // FIX-7: Also check cleaned text in case error message survived processing
      if (cleaned !== text && this.isUserFacingError(cleaned)) {
        this.maybeEmitUiErrorToast(messageId, cleaned);
      }

      this.deps.actions.dispatch({
        type: 'AGENT_SPOKE',
        timestamp: Date.now(),
        payload: { text: cleaned, voicePressure: 0.5 }
      });

      const agentId = this.deps.getAgentId();
      const sessId = this.deps.getSessionId();
      if (agentId && sessId) {
        const nowTs = Date.now();
        const tickTraceId = this.deps.getCurrentTraceId() ?? undefined;
        this.deps.archiveMessage(
          {
            id: messageId,
            role: 'assistant',
            content: cleaned,
            timestamp: nowTs,
            metadata: {
              traceId: tickTraceId,
              ...(meta?.knowledgeSource ? { knowledgeSource: meta.knowledgeSource } : {}),
              ...(meta?.evidenceSource ? { evidenceSource: meta.evidenceSource } : {}),
              ...(meta?.evidenceDetail ? { evidenceDetail: meta.evidenceDetail } : {}),
              ...(meta?.generator ? { generator: meta.generator } : {})
            }
          },
          agentId,
          sessId
        );

        this.deps.upsertLocalSessionSummary(sessId, cleaned, nowTs);
      }

      this.deps.logPhysiologySnapshot('POST_RESPONSE');
      this.deps.actions.setCurrentThought(text.slice(0, 100) + '...');
    } catch (e) {
      const errMsg = { role: 'assistant', text, type };
      this.deps.actions.addUiMessage(errMsg as any);
    }
  }
}
