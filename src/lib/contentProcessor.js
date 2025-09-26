/**
 * FUNCTIONAL CONTENT PROCESSOR
 *
 * Key principles:
 * 1. Pure functions separated from side effects
 * 2. Dependency injection instead of global state
 * 3. Immutable data structures
 * 4. Explicit error handling
 * 5. Composable functions
 */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

// =============================================================================
// PURE FUNCTIONS - CORE BUSINESS LOGIC
// =============================================================================

/**
 * Pure function to create parser function name from content type
 * @param {string} contentType - The content type
 * @returns {string} - The parser function name
 */
const createParserFunctionName = (contentType) =>
  `parse${contentType.charAt(0).toUpperCase() + contentType.slice(1)}Markdown`;

/**
 * Pure function to create post-processor function name from content type
 * @param {string} contentType - The content type
 * @returns {string} - The post-processor function name
 */
const createPostProcessorFunctionName = (contentType) =>
  `postProcess${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`;

/**
 * Pure function to get parser from registry
 * @param {Object} registry - Parser registry
 * @param {string} contentType - Content type
 * @param {Function} defaultParser - Fallback parser
 * @returns {Function} - Parser function
 */
const getParserFromRegistry = (registry, contentType, defaultParser) => {
  const specializedParser = registry[contentType];
  if (!specializedParser) return defaultParser;

  const parserFunctionName = createParserFunctionName(contentType);
  if (specializedParser[parserFunctionName]) {
    return specializedParser[parserFunctionName];
  }

  if (specializedParser.parseMarkdown) {
    return specializedParser.parseMarkdown;
  }

  return defaultParser;
};

/**
 * Pure function to get post-processor from registry
 * @param {Object} registry - Parser registry
 * @param {string} contentType - Content type
 * @returns {Function|null} - Post-processor function or null
 */
const getPostProcessorFromRegistry = (registry, contentType) => {
  const specializedParser = registry[contentType];
  if (!specializedParser) return null;

  const postProcessorFunctionName = createPostProcessorFunctionName(contentType);
  if (specializedParser[postProcessorFunctionName]) {
    return specializedParser[postProcessorFunctionName];
  }

  if (specializedParser.postProcess) {
    return specializedParser.postProcess;
  }

  return null;
};

/**
 * Pure function to parse frontmatter and content
 * @param {string} rawContent - Raw file content
 * @returns {Object} - Parsed content object
 */
const parseFrontmatter = (rawContent) => {
  const parsed = matter(rawContent);
  return {
    frontmatter: parsed.data,
    content: parsed.content.trim(),
    raw: rawContent
  };
};

// Semantic extraction functions have been moved to specialized parsers

/**
 * Pure function to create base URL
 * @param {string} contentType - Content type
 * @param {string} category - Category
 * @param {string} filename - Filename
 * @returns {string} - Generated URL
 */
const createUrl = (contentType, category, filename) => {
  const cleanFilename = filename.replace('.md', '');

  if (contentType === 'guidance') {
    return `/pending-guidance/${cleanFilename}/`;
  } else if (contentType === 'lists') {
    return `/lists/${cleanFilename}/`;
  }
  // Default to FAQ-style URLs for backward compatibility
  return `/faq/${category}/${cleanFilename}/`;
};

/**
 * Pure function to normalize content text
 * Ensures consistent capitalization of key terms
 * @param {string} content - Raw markdown content
 * @returns {string} - Normalized content
 */
const normalizeContent = (content) => {
  if (!content) return content;

  // Replace standalone "cra" (case-insensitive) with "CRA"
  // Uses word boundaries to avoid replacing parts of other words
  return content.replace(/\bcra\b/gi, 'CRA');
};

/**
 * Pure base parser - extracts only frontmatter and raw content
 * @param {Object} fileContent - Parsed file content
 * @param {string} filename - Filename
 * @param {string} category - Category
 * @param {string} contentType - Content type for URL generation
 * @returns {Object|null} - Base parsed item or null
 */
const parseMarkdown = (fileContent, filename, category, contentType = 'faq') => {
  if (!fileContent) return null;

  const { frontmatter, content } = fileContent;

  // Skip files with no frontmatter
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return null;
  }

  // Normalize content for consistent terminology
  const normalizedContent = normalizeContent(content);

  return {
    filename,
    category,
    rawContent: normalizedContent,
    url: createUrl(contentType, category, filename),
    // Flatten frontmatter to root level
    ...frontmatter
  };
};

/**
 * Pure function to normalize status
 * @param {Object} item - Item to normalize
 * @returns {Object} - Normalized item
 */
const normalizeStatus = (item) => {
  let status = item.Status;

  if (item['pending-guidance'] || item['guidance-id']) {
    status = 'pending-guidance';
  } else if (status) {
    status = status.replace(/⚠️\s*/, '').trim();
    status = status.toLowerCase().includes('draft') ? 'draft' : 'approved';
  } else {
    status = 'approved';
  }

  return { ...item, Status: status };
};

/**
 * Pure function to validate single item
 * @param {Object} item - Item to validate
 * @param {Function} validator - Validation function
 * @param {string} schemaType - Schema type
 * @param {string} context - Context for error messages
 * @returns {Object} - Validation result
 */
const validateItem = (item, validator, schemaType, context) => {
  const normalizedItem = normalizeStatus(item);
  const validationResult = validator(normalizedItem, schemaType, context);

  return {
    item: normalizedItem,
    isValid: validationResult.valid,
    errors: validationResult.errors || []
  };
};

/**
 * Pure function to partition items by validation result
 * @param {Array} items - Items to validate
 * @param {Function} validator - Validation function
 * @param {string} schemaType - Schema type
 * @param {string} context - Context for error messages
 * @returns {Object} - {valid: Array, invalid: Array}
 */
const partitionByValidation = (items, validator, schemaType, context) => {
  const results = items.map((item, index) =>
    validateItem(item, validator, schemaType, `${context}[${index}]`)
  );

  const valid = results
    .filter(result => result.isValid)
    .map(result => result.item);

  const invalid = results
    .filter(result => !result.isValid)
    .map((result, index) => ({
      item: result.item,
      errors: result.errors,
      index
    }));

  return { valid, invalid };
};

/**
 * Pure function to enrich FAQ items with guidance
 * @param {Array} faqItems - FAQ items
 * @param {Array} guidanceItems - Guidance items
 * @returns {Array} - Enriched FAQ items
 */
const enrichFaqsWithGuidance = (faqItems, guidanceItems) => {
  return faqItems.map(faq => {
    const guidanceKey = faq['pending-guidance'] || faq['guidance-id'];

    if (guidanceKey) {
      const relatedGuidance = guidanceItems.find(g =>
        g.filename.replace('.md', '') === guidanceKey
      );

      return {
        ...faq,
        hasPendingGuidanceCallout: true,
        relatedGuidance
      };
    }

    return {
      ...faq,
      hasPendingGuidanceCallout: false
    };
  });
};

/**
 * Pure function to extract title from guidance content
 * @param {Object} guidance - Guidance item
 * @returns {string} - Extracted title
 */
const extractGuidanceTitle = (guidance) => {
  let title = guidance.title || guidance.question;

  if (!title && guidance.content) {
    const titleMatch = guidance.content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }
  }

  if (!title) {
    title = guidance.filename
      .replace('.md', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  return title;
};

/**
 * Pure function to find related FAQs for guidance
 * @param {Object} guidance - Guidance item
 * @param {Array} faqItems - FAQ items to search
 * @returns {Array} - Related FAQ references
 */
const findRelatedFaqs = (guidance, faqItems) => {
  const guidanceKey = guidance.filename.replace('.md', '');

  return faqItems
    .filter(faq => {
      const faqGuidanceKey = faq['pending-guidance'] || faq['guidance-id'];
      return faqGuidanceKey === guidanceKey;
    })
    .map(faq => ({
      question: faq.question,
      url: faq.url
    }))
    .sort((a, b) => a.question.localeCompare(b.question));
};

/**
 * Pure function to enrich guidance items with related FAQs
 * @param {Array} guidanceItems - Guidance items
 * @param {Array} faqItems - FAQ items
 * @returns {Array} - Enriched guidance items
 */
const enrichGuidanceWithFaqs = (guidanceItems, faqItems) => {
  return guidanceItems.map(guidance => {
    const title = extractGuidanceTitle(guidance);
    const relatedFaqs = findRelatedFaqs(guidance, faqItems);

    return {
      ...guidance,
      title,
      relatedFaqs
    };
  });
};

/**
 * Pure function to create flat store from items
 * @param {Array} items - Items to store
 * @param {Function} keyExtractor - Function to extract key from item
 * @returns {Object} - Flat store
 */
const createFlatStore = (items, keyExtractor) => {
  return items.reduce((store, item) => {
    const key = keyExtractor(item);
    return {
      ...store,
      [key]: item
    };
  }, {});
};

/**
 * Pure function to create FAQ key
 * @param {Object} faq - FAQ item
 * @returns {string} - FAQ key
 */
const createFaqKey = (faq) =>
  `${faq.category}/${faq.filename.replace('.md', '')}`;

/**
 * Pure function to group items by category
 * @param {Array} items - Items to group
 * @returns {Object} - Items grouped by category
 */
const groupByCategory = (items) => {
  return items.reduce((grouped, item) => {
    const category = item.category;
    return {
      ...grouped,
      [category]: [...(grouped[category] || []), item]
    };
  }, {});
};

/**
 * Pure function to sort object keys and rebuild
 * @param {Object} obj - Object to sort
 * @returns {Object} - Object with sorted keys
 */
const sortObjectKeys = (obj) => {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      sorted[key] = obj[key];
    });
  return sorted;
};

/**
 * Pure function to extract guidance text from content
 * @param {string} content - Markdown content
 * @returns {string} - Extracted guidance text
 */
const extractGuidanceText = (content) => {
  if (!content) return "";

  const lines = content.split('\n');
  let isInGuidanceSection = false;
  let guidanceLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.match(/^#+\s*Guidance Needed/i)) {
      isInGuidanceSection = true;
      continue;
    }

    if (isInGuidanceSection && line.match(/^#+\s/)) {
      break;
    }

    if (isInGuidanceSection && line) {
      guidanceLines.push(line);
    }
  }

  const rawText = guidanceLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Convert markdown to HTML and then strip HTML tags for clean text
  if (rawText) {
    const markdownIt = require("markdown-it")();
    const htmlContent = markdownIt.render(rawText);
    return htmlContent.replace(/<[^>]*>/g, "").trim();
  }

  return rawText;
};

// =============================================================================
// IMPURE FUNCTIONS - I/O AND SIDE EFFECTS
// =============================================================================

/**
 * Impure function to read file content
 * @param {string} filePath - Path to file
 * @param {Function} logger - Logging function
 * @returns {Object|null} - File content or null on error
 */
const readFileContentIO = (filePath, logger = console.error) => {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return parseFrontmatter(raw);
  } catch (error) {
    logger(`⚠️ Error reading file ${filePath}:`, error.message);
    return null;
  }
};

/**
 * Impure function to check if directory exists
 * @param {string} dirPath - Directory path
 * @returns {boolean} - Whether directory exists
 */
const directoryExists = (dirPath) => {
  return fs.existsSync(dirPath);
};

/**
 * Impure function to read directory contents
 * @param {string} dirPath - Directory path
 * @returns {Array} - Directory entries
 */
const readDirectory = (dirPath) => {
  return fs.readdirSync(dirPath, { withFileTypes: true });
};

/**
 * Impure function to walk specific directory for a content type
 * @param {string} typeDir - Directory for specific content type
 * @param {string} typeName - Content type name
 * @returns {Array} - Files for this type
 */
const walkContentTypeDirectory = (typeDir, typeName) => {
  const files = [];

  if (!directoryExists(typeDir)) {
    console.warn(`⚠️ Content type directory does not exist: ${typeDir}`);
    return files;
  }

  const walkDirectory = (dir, category = "") => {
    if (!directoryExists(dir)) return;

    for (const entry of readDirectory(dir)) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDirectory(fullPath, entry.name);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push({
          filename: entry.name,
          fullPath,
          category: category || 'root',
          relativePath: path.relative(typeDir, fullPath),
          contentType: typeName
        });
      }
    }
  };

  walkDirectory(typeDir);
  return files;
};

/**
 * Impure function to walk all configured content type directories
 * @param {string} cacheDir - Cache directory
 * @param {Array} contentTypeNames - Array of content type names to process
 * @param {Function} getSourceDirectory - Function to get source directory for type
 * @returns {Object} - Files by type
 */
const walkConfiguredDirectories = (cacheDir, contentTypeNames, getSourceDirectory) => {
  const result = {};

  for (const typeName of contentTypeNames) {
    const typeDir = getSourceDirectory(typeName, cacheDir);
    if (typeDir) {
      result[typeName] = walkContentTypeDirectory(typeDir, typeName);
    } else {
      console.warn(`⚠️ No source directory configured for content type: ${typeName}`);
      result[typeName] = [];
    }
  }

  return result;
};

/**
 * Impure function to log validation results (success only)
 * Error details are handled by validation.js and logged to file
 * @param {Array} validItems - Valid items
 * @param {string} schemaType - Schema type
 * @param {Function} infoLogger - Info logging function
 */
const logValidationResults = (validItems, schemaType, infoLogger = console.log) => {
  if (validItems.length > 0) {
    infoLogger(`    ✅ ${validItems.length} valid ${schemaType} items included`);
  }
};

/**
 * Impure function to validate and filter with logging
 * @param {Array} items - Items to validate
 * @param {Function} validator - Validation function
 * @param {string} schemaType - Schema type
 * @param {string} context - Context
 * @param {Function} errorLogger - Error logger
 * @param {Function} infoLogger - Info logger
 * @returns {Array} - Valid items
 */
const validateAndFilterWithLogging = (items, validator, schemaType, context, errorLogger, infoLogger) => {
  const { valid, invalid } = partitionByValidation(items, validator, schemaType, context);
  logValidationResults(valid, schemaType, infoLogger);
  return valid;
};

// =============================================================================
// DEPENDENCY INJECTION HELPERS
// =============================================================================


/**
 * Create a content processor with injected dependencies
 * @param {Object} dependencies - Injected dependencies
 * @returns {Object} - Content processor functions
 */
const createContentProcessor = (dependencies = {}) => {
  const {
    parserRegistry = {},
    validator = require("./validation").validateData,
    fileReader = readFileContentIO,
    directoryWalker = walkConfiguredDirectories,
    logger = console,
    markdownParser = parseMarkdown
  } = dependencies;

  return {
    // Pure functions (no dependencies needed)
    parseMarkdown: markdownParser,
    normalizeStatus: normalizeStatus,
    enrichFaqsWithGuidance: enrichFaqsWithGuidance,
    enrichGuidanceWithFaqs: enrichGuidanceWithFaqs,
    extractGuidanceText: extractGuidanceText,

    // Registry functions
    getParser: (contentType) => getParserFromRegistry(parserRegistry, contentType, markdownParser),
    getPostProcessor: (contentType) => getPostProcessorFromRegistry(parserRegistry, contentType),

    // I/O functions with dependency injection
    readFileContent: (filePath) => fileReader(filePath, logger.error),
    walkConfiguredDirectories: (cacheDir, contentTypeNames, getSourceDirectory) =>
      directoryWalker(cacheDir, contentTypeNames, getSourceDirectory),
    validateAndFilterContent: (items, schemaType, context) =>
      validateAndFilterWithLogging(items, validator, schemaType, context, logger.error, logger.log),

    // Registry management
    registerParser: (contentType, parser) => {
      parserRegistry[contentType] = parser;
    }
  };
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Factory function
  createContentProcessor,

  // Pure functions for testing
  parseMarkdown,
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

  // I/O functions
  readFileContentIO,
  walkConfiguredDirectories,
  walkContentTypeDirectory,
  validateAndFilterWithLogging,

};