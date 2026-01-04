import type { Schema } from './SchemaStore';

export function createSchemaFromObservation(input: {
  concept: string;
  observation: string;
  evidenceRef: string;
}): Omit<Schema, 'id' | 'createdAt' | 'updatedAt'> | null {
  if (!input.evidenceRef || input.evidenceRef.trim() === '') {
    console.warn('[SchemaBuilder] REJECTED: no evidenceRef');
    return null;
  }

  const attributes = extractAttributes(input.observation).slice(0, 3);
  const concept = input.concept.slice(0, 50).trim();
  if (!concept) return null;

  return {
    concept,
    attributes,
    relations: [],
    confidence: 0.5,
    usageCount: 0,
    revision: 1,
    evidenceRefs: [input.evidenceRef]
  };
}

function extractAttributes(text: string): string[] {
  const patterns = text.match(/\b(has|is|uses|contains|requires|returns|accepts)_\w+/gi) || [];
  const keyValues = text.match(/\b\w+(?:Limit|Count|Size|Max|Min)\b/gi) || [];
  const all = [...new Set([...patterns, ...keyValues])];
  return all.slice(0, 3);
}
