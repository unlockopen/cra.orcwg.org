/**
 * Test suite for functional content processor
 * Covers dependency injection, pure functions, and two-phase processing
 */

const {
  createContentProcessor,
  parseBaseMarkdown,
  normalizeContent,
  normalizeStatus,
  enrichFaqsWithGuidance,
  enrichGuidanceWithFaqs,
  createFlatStore,
  createFaqKey,
  groupByCategory,
  sortObjectKeys,
  extractGuidanceText,
  partitionByValidation,
  walkContentTypeDirectory,
  validateAndFilterWithLogging
} = require('../src/lib/contentProcessor');

const faqParser = require('../src/lib/parsers/faq');
const guidanceParser = require('../src/lib/parsers/guidance');
const listParser = require('../src/lib/parsers/list');

// Mock dependencies for testing
const mockDependencies = {
  parserRegistry: {
    faq: faqParser,
    guidance: guidanceParser,
    list: listParser
  },
  validator: (item, schemaType, context) => ({
    valid: item.answer ? item.answer.length > 0 : true,
    errors: []
  }),
  fileReader: jest.fn(),
  directoryWalker: jest.fn(),
  logger: { log: jest.fn(), error: jest.fn() },
  markdownParser: jest.fn()
};

describe('Content Processor Architecture', () => {

  describe('createContentProcessor', () => {
    it('should create processor with default dependencies', () => {
      const processor = createContentProcessor();
      expect(processor).toBeDefined();
      expect(typeof processor.parseBaseMarkdown).toBe('function');
      expect(typeof processor.normalizeStatus).toBe('function');
      expect(typeof processor.validateAndFilterContent).toBe('function');
    });

    it('should accept custom dependencies via injection', () => {
      const customValidator = jest.fn();
      const processor = createContentProcessor({
        validator: customValidator
      });
      expect(processor).toBeDefined();
    });
  });
});

describe('Pure Functions - Core Business Logic', () => {

  describe('parseBaseMarkdown', () => {
    it('should parse markdown with frontmatter correctly', () => {
      const fileContent = {
        frontmatter: {
          title: 'Test FAQ',
          status: 'draft',
          'Related issue': 'https://github.com/test/issue/1'
        },
        content: '# What is a test?\n\nThis is a test answer with content.'
      };

      const result = parseBaseMarkdown(fileContent, 'test.md', 'category', 'faq');

      expect(result).toEqual({
        filename: 'test.md',
        category: 'category',
        contentType: 'faq',
        rawMarkdown: '# What is a test?\n\nThis is a test answer with content.',
        url: '/faq/category/test/',
        title: 'Test FAQ',
        status: 'draft',
        'Related issue': 'https://github.com/test/issue/1'
      });
    });

    it('should handle content without frontmatter', () => {
      const fileContent = {
        frontmatter: {},
        content: '# Just markdown content'
      };
      const result = parseBaseMarkdown(fileContent, 'test.md', 'category', 'faq');

      expect(result).toBeNull();
    });

    it('should generate correct URLs for different content types', () => {
      const fileContent = {
        frontmatter: { title: 'Test' },
        content: '# Test content'
      };

      const faqResult = parseBaseMarkdown(fileContent, 'test.md', 'category', 'faq');
      expect(faqResult.url).toBe('/faq/category/test/');

      const guidanceResult = parseBaseMarkdown(fileContent, 'test.md', 'category', 'guidance');
      expect(guidanceResult.url).toBe('/pending-guidance/test/');

      const listResult = parseBaseMarkdown(fileContent, 'test.md', 'category', 'lists');
      expect(listResult.url).toBe('/lists/test/');
    });

    it('should normalize categories correctly', () => {
      const fileContent = {
        frontmatter: { title: 'Test' },
        content: '# Test'
      };

      const result = parseBaseMarkdown(fileContent, 'test.md', 'my-category-name', 'faq');
      expect(result.category).toBe('my-category-name');
    });
  });

  describe('normalizeContent', () => {
    it('should convert hyphens to spaces and apply title case', () => {
      expect(normalizeContent('my-category-name')).toBe('My Category Name');
      expect(normalizeContent('CamelCase')).toBe('CamelCase');
      expect(normalizeContent('UPPERCASE')).toBe('UPPERCASE');
    });

    it('should handle special characters and normalize CRA', () => {
      expect(normalizeContent('test_underscore')).toBe('Test_underscore');
      expect(normalizeContent('test.dot')).toBe('Test.Dot');
      expect(normalizeContent('cra-itself')).toBe('CRA Itself');
    });
  });

  describe('normalizeStatus', () => {
    it('should set status to pending-guidance when guidance-id exists', () => {
      const item = {
        status: 'draft',
        'guidance-id': 'test-guidance',
        other: 'field'
      };
      const result = normalizeStatus(item);

      expect(result.status).toBe('pending-guidance');
      expect(result['guidance-id']).toBe('test-guidance');
      expect(result.other).toBe('field');
    });

    it('should clean up emoji and normalize draft status', () => {
      const item = { status: '⚠️ Draft' };
      const result = normalizeStatus(item);
      expect(result.status).toBe('draft');
    });

    it('should normalize pending guidance status', () => {
      const item = { status: '🛑 Pending Guidance' };
      const result = normalizeStatus(item);
      expect(result.status).toBe('pending-guidance');
    });

    it('should default non-draft/pending-guidance status to approved', () => {
      const item = { status: 'review' };
      const result = normalizeStatus(item);
      expect(result.status).toBe('approved');
    });

    it('should default missing status to null', () => {
      const item = { title: 'Test' };
      const result = normalizeStatus(item);
      expect(result.status).toBeNull();
    });

    it('should not mutate original item', () => {
      const originalItem = { status: 'draft', other: 'value' };
      const result = normalizeStatus(originalItem);

      expect(originalItem.status).toBe('draft');
      expect(result.status).toBe('draft');
      expect(result).not.toBe(originalItem);
    });
  });

  describe('createFlatStore', () => {
    it('should create flat store with FAQ key extractor', () => {
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

    it('should handle custom key extractors', () => {
      const items = [
        { id: 'a', name: 'Item A' },
        { id: 'b', name: 'Item B' }
      ];

      const customKeyExtractor = (item) => item.id;
      const result = createFlatStore(items, customKeyExtractor);

      expect(result).toEqual({
        'a': { id: 'a', name: 'Item A' },
        'b': { id: 'b', name: 'Item B' }
      });
    });
  });

  describe('createFaqKey', () => {
    it('should create correct FAQ keys', () => {
      const faq1 = { category: 'maintainers', filename: 'monetization.md' };
      expect(createFaqKey(faq1)).toBe('maintainers/monetization');

      const faq2 = { category: 'cra-itself', filename: 'scope.md' };
      expect(createFaqKey(faq2)).toBe('cra-itself/scope');
    });
  });

  describe('groupByCategory', () => {
    it('should group FAQ items by category', () => {
      const items = [
        { category: 'cat1', filename: 'file1.md' },
        { category: 'cat1', filename: 'file2.md' },
        { category: 'cat2', filename: 'file3.md' }
      ];

      const result = groupByCategory(items);

      expect(result).toEqual({
        cat1: [
          { category: 'cat1', filename: 'file1.md' },
          { category: 'cat1', filename: 'file2.md' }
        ],
        cat2: [
          { category: 'cat2', filename: 'file3.md' }
        ]
      });
    });
  });

  describe('sortObjectKeys', () => {
    it('should sort object keys alphabetically', () => {
      const input = { zebra: 1, apple: 2, banana: 3 };
      const result = sortObjectKeys(input);

      expect(Object.keys(result)).toEqual(['apple', 'banana', 'zebra']);
      expect(result).toEqual({ apple: 2, banana: 3, zebra: 1 });
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
        errors: item.answer.length === 0 ? [{ message: 'Required field' }] : []
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

describe('Cross-Reference Functions', () => {

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
          summary: 'Need clarification'
        }
      ];

      const result = enrichFaqsWithGuidance(faqItems, guidanceItems);

      expect(result[0]).toEqual({
        filename: 'test.md',
        'guidance-id': 'legal-person',
        question: 'Test question',
        relatedGuidance: {
          filename: 'legal-person.md',
          title: 'Legal Person Definition',
          summary: 'Need clarification'
        }
      });

      expect(result[1]).toEqual({
        filename: 'other.md',
        question: 'Other question'
      });
    });

    it('should handle missing guidance gracefully', () => {
      const faqItems = [
        {
          filename: 'test.md',
          'guidance-id': 'nonexistent',
          question: 'Test question'
        }
      ];

      const guidanceItems = [];
      const result = enrichFaqsWithGuidance(faqItems, guidanceItems);

      expect(result[0]).toEqual({
        filename: 'test.md',
        'guidance-id': 'nonexistent',
        question: 'Test question'
      });
    });
  });

  describe('enrichGuidanceWithFaqs', () => {
    it('should enrich guidance with related FAQs', () => {
      const guidanceItems = [
        {
          filename: 'legal-person.md',
          rawMarkdown: '# Legal Person Definition\n\nNeed clarification...'
        }
      ];

      const faqItems = [
        {
          filename: 'test1.md',
          'guidance-id': 'legal-person',
          question: 'Question 1',
          url: '/faq/test/test1/'
        },
        {
          filename: 'test2.md',
          'guidance-id': 'legal-person',
          question: 'Question 2',
          url: '/faq/test/test2/'
        },
        {
          filename: 'other.md',
          question: 'Unrelated question',
          url: '/faq/test/other/'
        }
      ];

      const result = enrichGuidanceWithFaqs(guidanceItems, faqItems);

      expect(result[0].relatedFaqs).toHaveLength(2);
      expect(result[0].relatedFaqs[0].question).toBe('Question 1');
      expect(result[0].relatedFaqs[1].question).toBe('Question 2');
      expect(result[0].relatedFaqs[0].url).toBe('/faq/test/test1/');
    });
  });
});

describe('Specialized Parsers', () => {

  describe('FAQ Parser', () => {
    it('should enhance FAQ items with question and answer', () => {
      const baseItem = {
        filename: 'test.md',
        category: 'maintainers',
        rawMarkdown: '# What is a test?\n\nThis is the answer to the test question.',
        status: 'draft'
      };

      const result = faqParser.enhanceFaqItem(baseItem);

      expect(result).toEqual({
        filename: 'test.md',
        category: 'maintainers',
        rawMarkdown: '# What is a test?\n\nThis is the answer to the test question.',
        status: 'draft',
        question: 'What is a test?',
        answer: 'This is the answer to the test question.'
      });
    });

    it('should handle FAQ without answer', () => {
      const baseItem = {
        filename: 'test.md',
        category: 'maintainers',
        rawMarkdown: '# What is a test?',
        status: 'draft'
      };

      const result = faqParser.enhanceFaqItem(baseItem);

      expect(result.question).toBe('What is a test?');
      expect(result.answer).toBeUndefined();
    });
  });

  describe('List Parser', () => {
    it('should enhance list items with title and description', () => {
      const baseItem = {
        filename: 'getting-started.md',
        category: 'root',
        rawMarkdown: '# Getting Started Guide\n\nEssential FAQs for beginners.',
        order: 1,
        faqs: ['cra-itself/cra', 'cra-itself/scope']
      };

      const result = listParser.enhanceListItem(baseItem);

      expect(result.title).toBe('Getting Started Guide');
      expect(result.description).toBe('Essential FAQs for beginners.');
      expect(result.order).toBe(1);
      expect(result.faqs).toEqual(['cra-itself/cra', 'cra-itself/scope']);
    });
  });
});

describe('I/O Functions', () => {

  describe('walkContentTypeDirectory', () => {
    it('should handle missing directories gracefully', () => {
      const result = walkContentTypeDirectory('/nonexistent/path', 'faq');
      expect(result).toEqual([]);
    });
  });

  describe('validateAndFilterWithLogging', () => {
    it('should filter and log validation results', () => {
      const items = [
        { id: 1, answer: 'Valid' },
        { id: 2, answer: '' }
      ];

      const mockValidator = (item) => ({
        valid: item.answer.length > 0,
        errors: item.answer.length === 0 ? ['Missing answer'] : []
      });

      const mockErrorLogger = jest.fn();
      const mockInfoLogger = jest.fn();

      const result = validateAndFilterWithLogging(
        items,
        mockValidator,
        'test',
        'context',
        mockErrorLogger,
        mockInfoLogger
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(mockInfoLogger).toHaveBeenCalled();
    });
  });
});

describe('Integration Tests', () => {

  describe('Processor Functions', () => {
    it('should expose correct interface', () => {
      const processor = createContentProcessor(mockDependencies);

      expect(typeof processor.parseBaseMarkdown).toBe('function');
      expect(typeof processor.normalizeStatus).toBe('function');
      expect(typeof processor.enrichFaqsWithGuidance).toBe('function');
      expect(typeof processor.getEnhancer).toBe('function');
      expect(typeof processor.readFileContent).toBe('function');
    });
  });

  describe('Base Parsing with Enhancement', () => {
    it('should parse and enhance content correctly', () => {
      const processor = createContentProcessor(mockDependencies);

      // Test base parsing
      const fileContent = {
        frontmatter: {
          title: 'Test FAQ',
          status: 'draft'
        },
        content: '# What is a test?\n\nThis is the answer.'
      };

      const baseItem = processor.parseBaseMarkdown(fileContent, 'test.md', 'maintainers', 'faq');
      expect(baseItem).toBeDefined();
      expect(baseItem.title).toBe('Test FAQ');

      // Test getting enhancer
      const enhancer = processor.getEnhancer('faq');
      expect(enhancer).toBeDefined();

      // Test enhancement
      const enhanced = enhancer(baseItem);
      expect(enhanced).toBeDefined();
      expect(enhanced.question).toBe('What is a test?');
      expect(enhanced.answer).toBe('This is the answer.');
    });
  });
});