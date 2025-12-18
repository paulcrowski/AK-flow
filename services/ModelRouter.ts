export type ModelTask = 'text' | 'json' | 'deep_research';

export type ModelRoute = {
  task: ModelTask;
  models: string[]; // ordered fallback chain
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
