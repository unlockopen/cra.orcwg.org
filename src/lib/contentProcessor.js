/**
 * FUNCTIONAL CONTENT PROCESSOR
 *
 * Key principles:
 * 1. Functions with clear separation of concerns
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
 * Create post-processor function name from content type
 * @param {string} contentType - The content type
 * @returns {string} - The post-processor function name
 */
const createPostProcessorFunctionName = (contentType) =>
  `postProcess${contentType.charAt(0).toUpperCase() + contentType.slice(1)}`;

/**
 * Get enhancer function from registry for pure functional pipeline
 * @param {Object} registry - Parser registry
 * @param {string} contentType - Content type
 * @returns {Function|null} - Enhancer function or null
 */
const getEnhancerFromRegistry = (registry, contentType) => {
  const specializedParser = registry[contentType];
  if (!specializedParser) return null;

  // Look for enhance function first (new pattern)
  const enhancerFunctionName = `enhance${contentType.charAt(0).toUpperCase() + contentType.slice(1)}Item`;
  if (specializedParser[enhancerFunctionName]) {
    return specializedParser[enhancerFunctionName];
  }

  // Fallback to enhance function
  if (specializedParser.enhance) {
    return specializedParser.enhance;
  }

  return null;
};


/**
 * Get post-processor from registry
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
 * Parse frontmatter and content
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
 * Create base URL
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
 * Normalize content text
 * Ensures consistent capitalization of key terms
 * @param {string} content - Raw markdown content
 * @returns {string} - Normalized content
 */
const normalizeContent = (content) => {
  if (!content) return content;

  // Replace hyphens with spaces
  const spacesReplaced = content.replace(/-/g, ' ');

  // Apply title case (capitalize first letter of each word)
  const titleCased = spacesReplaced.replace(/\b\w/g, l => l.toUpperCase());

  // Then replace standalone "cra" or "Cra" (case-insensitive) with "CRA"
  // Uses word boundaries to avoid replacing parts of other words
  return titleCased.replace(/\bcra\b/gi, 'CRA');
};

/**
 * Pure base parser - only handles frontmatter extraction and common fields
 * @param {Object} fileContent - Parsed file content
 * @param {string} filename - Filename
 * @param {string} category - Category
 * @param {string} contentType - Content type for URL generation
 * @returns {Object|null} - Base item with common fields or null
 */
const parseBaseMarkdown = (fileContent, filename, category, contentType = 'faq') => {
  if (!fileContent) return null;

  const { frontmatter, content } = fileContent;

  // Skip files with no frontmatter
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return null;
  }

  // Create base item with common fields only
  return {
    filename,
    category,
    contentType,
    rawMarkdown: content,
    url: createUrl(contentType, category, filename),
    // Flatten frontmatter to root level
    ...frontmatter
  };
};


/**
 * Normalize status to lowercase
 * @param {Object} item - Item to normalize
 * @returns {Object} - Normalized item
 */
const normalizeStatus = (item) => {
  let status = item.Status || item.status;

  if (item['guidance-id']) {
    status = 'pending-guidance';
  } else if (status) {
    status = status.replace(/🛑\s*/, '').replace(/⚠️\s*/, '').trim();
    if (status.toLowerCase().includes('draft')) {
      status = 'draft';
    } else if (status.toLowerCase().includes('pending guidance')) {
      status = 'pending-guidance';
    } else {
      status = 'approved';
    }
  } else {
    status = null;
  }

  const { Status, ...itemWithoutStatus } = item;
  return { ...itemWithoutStatus, status: status };
};

/**
 * Validate single item
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
 * Partition items by validation result
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
 * Enrich FAQ items with guidance
 * @param {Array} faqItems - FAQ items
 * @param {Array} guidanceItems - Guidance items
 * @returns {Array} - Enriched FAQ items
 */
const enrichFaqsWithGuidance = (faqItems, guidanceItems) => {
  return faqItems.map(faq => {
    const guidanceKey = faq['guidance-id'];

    if (guidanceKey) {
      const relatedGuidance = guidanceItems.find(g =>
        g.filename.replace('.md', '') === guidanceKey
      );

      return {
        ...faq,
        // Only add fields if they exist - no boolean flags
        ...(relatedGuidance && { relatedGuidance })
      };
    }

    return faq; // No changes if no guidance
  });
};

/**
 * Extract title from guidance content
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
 * Find related FAQs for guidance
 * @param {Object} guidance - Guidance item
 * @param {Array} faqItems - FAQ items to search
 * @returns {Array} - Related FAQ references
 */
const findRelatedFaqs = (guidance, faqItems) => {
  const guidanceKey = guidance.filename.replace('.md', '');

  return faqItems
    .filter(faq => {
      const faqGuidanceKey = faq['guidance-id'];
      return faqGuidanceKey === guidanceKey;
    })
    .map(faq => ({
      question: faq.question,
      url: faq.url
    }))
    .sort((a, b) => a.question.localeCompare(b.question));
};

/**
 * Enrich guidance items with related FAQs
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
 * Create flat store from items
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
 * Create FAQ key
 * @param {Object} faq - FAQ item
 * @returns {string} - FAQ key
 */
const createFaqKey = (faq) =>
  `${faq.category}/${faq.filename.replace('.md', '')}`;

/**
 * Group items by category
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
 * Sort object keys and rebuild
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
 * Extract guidance text from content
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
 * Read file content
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
 * Check if directory exists
 * @param {string} dirPath - Directory path
 * @returns {boolean} - Whether directory exists
 */
const directoryExists = (dirPath) => {
  return fs.existsSync(dirPath);
};

/**
 * Read directory contents
 * @param {string} dirPath - Directory path
 * @returns {Array} - Directory entries
 */
const readDirectory = (dirPath) => {
  return fs.readdirSync(dirPath, { withFileTypes: true });
};

/**
 * Walk specific directory for a content type
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
 * Walk all configured content type directories
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
 * Log validation results (success only)
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
 * Validate and filter with logging
 * @param {Array} items - Items to validate
 * @param {Function} validator - Validation function
 * @param {string} schemaType - Schema type
 * @param {string} context - Context
 * @param {Function} _errorLogger - Error logger (unused, errors handled by validator)
 * @param {Function} infoLogger - Info logger
 * @returns {Array} - Valid items
 */
const validateAndFilterWithLogging = (items, validator, schemaType, context, _errorLogger, infoLogger) => {
  const { valid } = partitionByValidation(items, validator, schemaType, context);
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
    logger = console
  } = dependencies;

  return {
    // Core business logic functions
    parseBaseMarkdown: parseBaseMarkdown,
    normalizeStatus: normalizeStatus,
    enrichFaqsWithGuidance: enrichFaqsWithGuidance,
    enrichGuidanceWithFaqs: enrichGuidanceWithFaqs,
    extractGuidanceText: extractGuidanceText,

    // Registry functions
    getEnhancer: (contentType) => getEnhancerFromRegistry(parserRegistry, contentType),
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

  // Testable functions
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

  // I/O functions
  readFileContentIO,
  walkConfiguredDirectories,
  walkContentTypeDirectory,
  validateAndFilterWithLogging,

};