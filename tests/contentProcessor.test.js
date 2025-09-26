/**
 * Test suite for functional content processor
 * Demonstrates how pure functions are easy to test
 */

const {
  parseMarkdown,
  normalizeStatus,
  enrichFaqsWithGuidance,
  createFlatStore,
  createFaqKey,
  partitionByValidation,
  extractGuidanceText
} = require('../src/lib/contentProcessor');

describe('Content Processor Pure Functions', () => {

  describe('parseMarkdown', () => {
    it('should parse markdown with frontmatter correctly', () => {
      const input = {
        frontmatter: {
          title: 'Test Title',
          status: 'draft',
          'guidance-id': 'test-guidance'
        },
        content: '# What is a test?\\n\\nThis is a test answer.',
        raw: '---\\ntitle: Test Title\\n---\\n# What is a test?\\n\\nThis is a test answer.'
      };

      const result = parseMarkdown(input, 'test.md', 'category', 'faq');

      expect(result).toEqual({
        filename: 'test.md',
        category: 'category',
        rawContent: '# What is a test?\\n\\nThis is a test answer.',
        data: {
          title: 'Test Title',
          status: 'draft',
          'guidance-id': 'test-guidance'
        },
        url: '/faq/category/test/'
      });
    });

    it('should return null for content without frontmatter', () => {
      const input = {
        frontmatter: {},
        content: '# No frontmatter',
        raw: '# No frontmatter'
      };

      const result = parseMarkdown(input, 'test.md', 'category');
      expect(result).toBeNull();
    });

    it('should handle content without title', () => {
      const input = {
        frontmatter: { status: 'approved' },
        content: 'Content without title',
        raw: '---\\nstatus: approved\\n---\\nContent without title'
      };

      const result = parseMarkdown(input, 'test.md', 'category');

      expect(result.data).toEqual({ status: 'approved' });
      expect(result.rawContent).toBe('Content without title');
    });

    it('should generate correct URLs for different content types', () => {
      const input = {
        frontmatter: { title: 'Test' },
        content: '# Test',
        raw: 'test'
      };

      const faqResult = parseMarkdown(input, 'test.md', 'category', 'faq');
      expect(faqResult.url).toBe('/faq/category/test/');

      const guidanceResult = parseMarkdown(input, 'test.md', 'category', 'guidance');
      expect(guidanceResult.url).toBe('/pending-guidance/test/');
    });
  });

  describe('normalizeStatus', () => {
    it('should set status to pending-guidance when guidance-id exists', () => {
      const item = { Status: 'draft', 'guidance-id': 'test-guidance' };
      const result = normalizeStatus(item);

      expect(result.Status).toBe('pending-guidance');
      expect(result['guidance-id']).toBe('test-guidance'); // Should preserve other fields
    });

    it('should clean up emoji and normalize draft status', () => {
      const item = { Status: '⚠️ Draft' };
      const result = normalizeStatus(item);

      expect(result.Status).toBe('draft');
    });

    it('should default non-draft status to approved', () => {
      const item = { Status: 'review' };
      const result = normalizeStatus(item);

      expect(result.Status).toBe('approved');
    });

    it('should default missing status to approved', () => {
      const item = { title: 'Test' };
      const result = normalizeStatus(item);

      expect(result.Status).toBe('approved');
    });

    it('should not mutate original item', () => {
      const originalItem = { Status: 'draft' };
      const result = normalizeStatus(originalItem);

      expect(originalItem.Status).toBe('draft'); // Original unchanged
      expect(result.Status).toBe('draft');
      expect(result).not.toBe(originalItem); // Different object
    });
  });

  describe('enrichFaqsWithGuidance', () => {
    it('should enrich FAQs with related guidance', () => {
      const faqItems = [
        {
          filename: 'test.md',
          'guidance-id': 'legal-person',
          question: 'Test question'
        },
        {
          filename: 'other.md',
          question: 'Other question'
        }
      ];

      const guidanceItems = [
        {
          filename: 'legal-person.md',
          title: 'Legal Person Definition',
          guidanceNeeded: 'Need clarification'
        }
      ];

      const result = enrichFaqsWithGuidance(faqItems, guidanceItems);

      expect(result[0]).toEqual({
        filename: 'test.md',
        'guidance-id': 'legal-person',
        question: 'Test question',
        hasPendingGuidanceCallout: true,
        relatedGuidance: {
          filename: 'legal-person.md',
          title: 'Legal Person Definition',
          guidanceNeeded: 'Need clarification'
        }
      });

      expect(result[1]).toEqual({
        filename: 'other.md',
        question: 'Other question',
        hasPendingGuidanceCallout: false
      });
    });
  });

  describe('createFlatStore', () => {
    it('should create flat store with custom key extractor', () => {
      const items = [
        { category: 'cat1', filename: 'file1.md' },
        { category: 'cat2', filename: 'file2.md' }
      ];

      const result = createFlatStore(items, createFaqKey);

      expect(result).toEqual({
        'cat1/file1': { category: 'cat1', filename: 'file1.md' },
        'cat2/file2': { category: 'cat2', filename: 'file2.md' }
      });
    });
  });

  describe('partitionByValidation', () => {
    it('should partition items by validation result', () => {
      const items = [
        { id: 1, answer: 'Valid answer' },
        { id: 2, answer: '' }, // Invalid - empty answer
        { id: 3, answer: 'Another valid answer' }
      ];

      const mockValidator = (item, schemaType, context) => ({
        valid: item.answer.length > 0,
        errors: item.answer.length === 0 ? [{ path: 'answer', message: 'Required field' }] : []
      });

      const result = partitionByValidation(items, mockValidator, 'test', 'context');

      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].id).toBe(1);
      expect(result.valid[1].id).toBe(3);

      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].item.id).toBe(2);
      expect(result.invalid[0].errors).toHaveLength(1);
    });
  });

  describe('extractGuidanceText', () => {
    it('should extract text from guidance needed section', () => {
      const content = `# Title

## Background
Some background info.

## Guidance needed
This is the guidance we need from the commission.

## Why this matters
This explains why.`;

      const result = extractGuidanceText(content);
      expect(result).toBe('This is the guidance we need from the commission.');
    });

    it('should handle case variations in section heading', () => {
      const content = `## Guidance Needed
Case variation test.

## Next section`;

      const result = extractGuidanceText(content);
      expect(result).toBe('Case variation test.');
    });

    it('should return empty string for content without guidance section', () => {
      const content = `# Title
Some content without guidance section.`;

      const result = extractGuidanceText(content);
      expect(result).toBe('');
    });

    it('should handle multiline guidance text', () => {
      const content = `## Guidance needed
Line one of guidance.
Line two of guidance.

## Next section`;

      const result = extractGuidanceText(content);
      expect(result).toBe('Line one of guidance. Line two of guidance.');
    });
  });
});

// Integration tests for the pipeline functions
describe('Pipeline Integration', () => {
  // Note: These tests would need the pure functions from orcwgImport
  // Commenting out for now since they reference non-existent modules

  // TODO: Add integration tests when pipeline functions are extracted to testable modules
});