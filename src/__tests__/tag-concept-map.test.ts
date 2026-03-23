import { describe, it, expect } from 'vitest';
import {
  tagsToConceptSlugs,
  tagsToFirstConceptSlug,
} from '@/lib/knowledge-graph/tag-concept-map';

describe('tag-concept-map', () => {
  describe('tagsToConceptSlugs', () => {
    it('maps basic tags and deduplicates', () => {
      const result = tagsToConceptSlugs(['arrays', 'strings'], null);
      expect(result).toEqual(['arrays-strings']);
    });

    it('includes primaryPattern when tags are empty', () => {
      const result = tagsToConceptSlugs([], 'dynamic-programming');
      expect(result).toEqual(['dynamic-programming']);
    });

    it('deduplicates when tags and primaryPattern map to same slug', () => {
      const result = tagsToConceptSlugs(['graphs', 'bfs'], 'dfs');
      expect(result).toEqual(['graphs-bfs-dfs']);
    });

    it('ignores unmapped tags', () => {
      const result = tagsToConceptSlugs(['some-unknown-tag', 'arrays'], null);
      expect(result).toEqual(['arrays-strings']);
    });

    it('returns empty array for empty input', () => {
      const result = tagsToConceptSlugs([], null);
      expect(result).toEqual([]);
    });

    it('combines multiple different concept slugs', () => {
      const result = tagsToConceptSlugs(['arrays', 'trees', 'heap'], null);
      expect(result).toEqual(['arrays-strings', 'trees-traversal', 'heaps']);
    });
  });

  describe('tagsToFirstConceptSlug', () => {
    it('returns first slug from tags', () => {
      const result = tagsToFirstConceptSlug(['trees', 'graphs'], null);
      expect(result).toBe('trees-traversal');
    });

    it('returns null for empty/unmapped input', () => {
      const result = tagsToFirstConceptSlug(['unknown'], null);
      expect(result).toBeNull();
    });

    it('uses primaryPattern fallback when tags are empty', () => {
      const result = tagsToFirstConceptSlug([], 'heap');
      expect(result).toBe('heaps');
    });

    it('returns null when both tags and primaryPattern are unmapped', () => {
      const result = tagsToFirstConceptSlug(['unknown'], 'also-unknown');
      expect(result).toBeNull();
    });

    it('prefers tags over primaryPattern when both map', () => {
      const result = tagsToFirstConceptSlug(['arrays'], 'heap');
      expect(result).toBe('arrays-strings');
    });
  });
});
