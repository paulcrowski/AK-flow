export type ModelTask = 'text' | 'json' | 'deep_research';

export type ModelRoute = {
  task: ModelTask;
  models: string[]; // ordered fallback chain
};

export type ModelFallbackSuccess<T> = {
  model: string;
  value: T;
  errors: string[];
  attempts: number;
};

const ROUTES: Record<ModelTask, ModelRoute> = {
  text: {
    task: 'text',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro']
  },
  json: {
    task: 'json',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro']
  },
  deep_research: {
    task: 'deep_research',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro']
  }
};

export const ModelRouter = {
  routeForOperation(operation: string): ModelTask {
    const op = String(operation || '').trim();
    if (op === 'deepResearch') return 'deep_research';
    if (op === 'generateJSON') return 'json';
    return 'text';
  },

  getModelChain(task: ModelTask): string[] {
    return [...(ROUTES[task]?.models ?? ROUTES.text.models)];
  }
};

export async function runWithModelFallback<T>(
  models: string[],
  fn: (model: string) => Promise<T>
): Promise<ModelFallbackSuccess<T>> {
  const chain = Array.isArray(models) ? models.filter(Boolean) : [];
  const errors: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    try {
      const value = await fn(model);
      return { model, value, errors, attempts: i + 1 };
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      errors.push(`${model}: ${msg}`);
    }
  }
  throw new Error(`MODEL_FALLBACK_FAILED: ${errors.join(' | ')}`);
}
