export type Chunk = {
  chunk_index: number;
  start_offset: number;
  end_offset: number;
  content: string;
};

export type ChunkingConfig = {
  targetChars: number;
  maxChars: number;
  overlapChars: number;
  maxChunks: number;
  singleChunkBelowChars: number;
};

export type ChunkImportance = {
  score: number;
  isStructural: boolean;
  hasEmphasis: boolean;
  isIntro: boolean;
  isConclusion: boolean;
  keywordHits: string[];
};

export type ActiveLearningMetrics = {
  importance: number;
  surprise: number;
  actionable: number;
  concepts: string[];
};
