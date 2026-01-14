import { describe, expect, test } from 'vitest';
import { resolveImplicitReference } from '../../src/core/systems/eventloop/reactiveStep.helpers';

describe('Library Anchor Resolver', () => {
  const stateWithAnchor = {
    lastLibraryDocId: 'b4df0a54-97da-43c7-ad71-f2161e2ac8f6',
    lastWorldPath: '/code',
    lastArtifactId: 'art-123'
  };

  const stateEmpty = {
    lastLibraryDocId: null,
    lastWorldPath: null,
    lastArtifactId: null
  };

  describe('Library references', () => {
    test.each([
      'co jest w tej ksiazce?',
      'pokaz chunki z ksiazki',
      'o czym jest ta ksiazka',
      'fragmenty dokumentu',
      'pokaz mi tresc',
      'ta ksiazka',
      'tego dokumentu'
    ])('"%s" resolves to library anchor', (input) => {
      const result = resolveImplicitReference(input, stateWithAnchor);
      expect(result.type).toBe('library_doc');
      expect(result.id).toBe(stateWithAnchor.lastLibraryDocId);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test('explicit name does not use anchor', () => {
      const result = resolveImplicitReference(
        'przeczytaj "Reinforcement Learning.txt"',
        stateWithAnchor
      );
      expect(result.type).toBeNull();
      expect(result.id).toBeNull();
    });

    test('explicit path does not use anchor', () => {
      const result = resolveImplicitReference('/code/docs/plan.md', stateWithAnchor);
      expect(result.type).toBeNull();
      expect(result.id).toBeNull();
    });

    test('no anchor returns null', () => {
      const result = resolveImplicitReference('ta ksiazka', stateEmpty);
      expect(result.type).toBeNull();
      expect(result.id).toBeNull();
    });
  });

  describe('World references', () => {
    test.each([
      'co jest tam?',
      'pokaz co jest w tym folderze',
      'pliki tutaj'
    ])('"%s" resolves to world anchor', (input) => {
      const result = resolveImplicitReference(input, stateWithAnchor);
      expect(result.type).toBe('world_path');
      expect(result.id).toBe(stateWithAnchor.lastWorldPath);
    });
  });

  describe('Artifact references', () => {
    test.each([
      'ten plik',
      'w tym pliku',
      'ten artefakt'
    ])('"%s" resolves to artifact anchor', (input) => {
      const result = resolveImplicitReference(input, stateWithAnchor);
      expect(result.type).toBe('artifact');
      expect(result.id).toBe(stateWithAnchor.lastArtifactId);
    });
  });
});
