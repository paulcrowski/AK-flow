export const ACTIVE_LEARNING_TOP_K = 15;
export const MIN_IMPORTANCE = 3;
export const MAX_ACTIVE_STRENGTH = 12;
export const MAX_CHUNKS_PER_TICK = 5;
export const FAST_INGEST_CHAR_THRESHOLD = 200_000;
export const FAST_INGEST_CHUNK_THRESHOLD = 80;
export const FAST_INGEST_ACTIVE_LEARNING_LIMIT = 10;
export const SUMMARY_MAX_OUTPUT_TOKENS = 256;
export const DOCUMENT_TOPIC_MIN_COUNT = 2;
export const DOCUMENT_TOPIC_MAX = 6;

export const DOCUMENT_TOPIC_STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'into', 'about', 'there', 'their', 'these', 'those',
  'which', 'while', 'where', 'when', 'what', 'will', 'have', 'has', 'were', 'been',
  'your', 'yours', 'their', 'them', 'they', 'then', 'than', 'also', 'some', 'more',
  'less', 'such', 'very', 'just', 'like', 'over', 'under', 'between',
  'jest', 'jako', 'oraz', 'sie', 'siez', 'taki', 'taka', 'takie', 'dla', 'oraz', 'oraz',
  'jego', 'jej', 'ich', 'ten', 'tam', 'tutaj', 'tutaj', 'dzis', 'dzisiaj'
]);

export const IMPORTANCE_KEYWORDS = [
  'summary',
  'conclusion',
  'results',
  'finding',
  'findings',
  'recommendation',
  'recommendations',
  'important',
  'key',
  'must',
  'should',
  'overview',
  'introduction',
  'objective',
  'objectives',
  'goal',
  'goals',
  'scope',
  'critical',
  'note',
  'warning',
  'tl;dr',
  'podsumowanie',
  'wnioski',
  'wyniki',
  'ustalenia',
  'rekomendacje',
  'zalecenia',
  'wstep',
  'cel',
  'cele',
  'zakres',
  'istotne',
  'kluczowe',
  'uwaga',
  'ostrzezenie',
  'ryzyko',
  'decyzja',
  'dzialanie'
];
