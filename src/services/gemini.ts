import { createGeminiClient } from "./gemini/aiClient";
import { createVisualCortex } from "./gemini/VisualCortex";
import { createDreamService } from "./gemini/DreamService";
import { createCortexTextService } from "./gemini/CortexTextService";

// 1. Safe Environment Access & Initialization (Vite)
const ai = createGeminiClient();

// Types preserved for public API compatibility
export type { JSONParseResult } from './gemini/json';

export const CortexService = {
    ...createVisualCortex(ai),
    ...createDreamService(ai),
    ...createCortexTextService(ai)
};
