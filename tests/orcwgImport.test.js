/**
 * Integration test for the main data pipeline
 * Tests the full orcwgImport pipeline with real data processing
 */

const orcwgImport = require('../src/_data/orcwgImport');

describe('orcwgImport Integration', () => {

  describe('Main data pipeline', () => {
    it('should process content and return expected data structure', async () => {
      const result = orcwgImport();

      // Should have basic structure
      expect(result).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.faq).toBeDefined();
      expect(result.guidance).toBeDefined();
      expect(result.list).toBeDefined();
      expect(result.categories).toBeDefined();

      // Stats should be populated
      expect(result.stats.processedAt).toBeDefined();
      expect(result.stats.types).toContain('faq');
      expect(result.stats.types).toContain('guidance');
      expect(result.stats.types).toContain('list');

      // Categories should be properly structured
      if (Object.keys(result.categories).length > 0) {
        const firstCategory = Object.keys(result.categories)[0];
        expect(Array.isArray(result.categories[firstCategory])).toBe(true);
      }

      // FAQ lookup should be properly structured
      if (Object.keys(result.faq).length > 0) {
        const firstFaqKey = Object.keys(result.faq)[0];
        const firstFaq = result.faq[firstFaqKey];
        expect(firstFaq.filename).toBeDefined();
        expect(firstFaq.category).toBeDefined();
        expect(firstFaq.url).toBeDefined();
      }
    }, 10000); // Allow up to 10 seconds for processing

    it('should have consistent data relationships', () => {
      const result = orcwgImport();

      // Each category should reference valid FAQ keys
      Object.entries(result.categories).forEach(([category, faqKeys]) => {
        faqKeys.forEach(faqKey => {
          expect(result.faq[faqKey]).toBeDefined();
          expect(result.faq[faqKey].category).toBe(category);
        });
      });

      // Cross-references should be valid
      if (result.crossReferences) {
        Object.entries(result.crossReferences).forEach(([key, refs]) => {
          if (refs.faqs) {
            refs.faqs.forEach(faqKey => {
              expect(result.faq[faqKey]).toBeDefined();
            });
          }
        });
      }
    });

    it('should handle empty content gracefully', () => {
      // This test ensures the pipeline doesn't crash with minimal content
      const result = orcwgImport();

      expect(result.stats).toBeDefined();
      expect(Array.isArray(result.guidance)).toBe(true);
      expect(Array.isArray(result.list)).toBe(true);
      expect(typeof result.faq).toBe('object');
      expect(typeof result.categories).toBe('object');
    });
  });
});