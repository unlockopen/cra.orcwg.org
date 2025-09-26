const path = require("path");
const { createContentProcessor } = require("../lib/contentProcessor");
const {
  CONTENT_TYPE_NAMES,
  getSourceDirectory,
  createParserRegistry
} = require("../lib/contentConfig");
const { clearValidationLog } = require("../lib/validation");

// =============================================================================
// PIPELINE FUNCTIONS
// =============================================================================
/**
 * Phase 1: Parse files to base items using pure base parser
 * @param {Array} files - Files to parse
 * @param {Function} baseParser - Base parser function
 * @param {Function} fileReader - File reading function
 * @param {string} contentType - Content type for URL generation
 * @returns {Array} - Base parsed items
 */
const parseFilesToBaseItems = (files, baseParser, fileReader, contentType) => {
  return files
    .map(file => {
      const content = fileReader(file.fullPath);
      return baseParser(content, file.filename, file.category, contentType);
    })
    .filter(Boolean);
};

/**
 * Phase 2: Apply content-specific enhancement to base items
 * @param {Array} baseItems - Base parsed items
 * @param {Function} enhancer - Content-specific enhancer function
 * @returns {Array} - Enhanced items
 */
const enhanceBaseItems = (baseItems, enhancer) => {
  if (!enhancer) return baseItems;
  return baseItems.map(enhancer);
};

/**
 * DEPRECATED: Parse files for a single content type
 * Use parseFilesToBaseItems + enhanceBaseItems instead
 * @deprecated
 */
const parseFilesForType = (files, parser, fileReader, contentType) => {
  return files
    .map(file => {
      const content = fileReader(file.fullPath);
      return parser(content, file.filename, file.category, contentType);
    })
    .filter(Boolean);
};

/**
 * Parse all content types using pure two-phase approach
 * @param {Object} filesByType - Files by type
 * @param {Function} baseParser - Pure base parser function
 * @param {Function} getEnhancer - Enhancer getter function
 * @param {Function} fileReader - File reader function
 * @returns {Object} - Parsed items by type
 */
const parseAllContentTypes = (filesByType, baseParser, getEnhancer, fileReader) => {
  const parsedItemsByType = {};

  for (const type in filesByType) {
    // Phase 1: Parse to base items
    const baseItems = parseFilesToBaseItems(filesByType[type], baseParser, fileReader, type);

    // Phase 2: Apply content-specific enhancement
    const enhancer = getEnhancer(type);
    parsedItemsByType[type] = enhanceBaseItems(baseItems, enhancer);
  }

  return parsedItemsByType;
};

/**
 * Apply post-processing to all types
 * @param {Object} parsedItemsByType - Parsed items by type
 * @param {Function} getPostProcessor - Post-processor getter function
 * @returns {Object} - Post-processed items by type
 */
const applyPostProcessing = (parsedItemsByType, getPostProcessor) => {
  const processedItems = { ...parsedItemsByType };

  for (const type in processedItems) {
    const postProcessor = getPostProcessor(type);
    if (postProcessor) {
      processedItems[type] = postProcessor(processedItems[type], processedItems);
    }
  }

  return processedItems;
};

/**
 * Validate all content types
 * @param {Object} parsedItemsByType - Parsed items by type
 * @param {Function} validator - Validation function
 * @returns {Object} - {valid: Object, invalid: Object}
 */
const validateAllContentTypes = (parsedItemsByType, validator) => {
  const validItemsByType = {};
  const invalidItemsByType = {};

  for (const type in parsedItemsByType) {
    const validItems = validator(parsedItemsByType[type], type, `${type} items`);
    validItemsByType[type] = validItems;

    // Calculate invalid items
    if (parsedItemsByType[type].length > validItems.length) {
      const validSet = new Set(validItems);
      invalidItemsByType[type] = parsedItemsByType[type].filter(item => !validSet.has(item));
    } else {
      invalidItemsByType[type] = [];
    }
  }

  return { valid: validItemsByType, invalid: invalidItemsByType };
};

/**
 * Generate processing statistics
 * @param {Object} filesByType - Files by type
 * @param {Object} parsedItemsByType - Parsed items by type
 * @param {Object} validItemsByType - Valid items by type
 * @param {Object} invalidItemsByType - Invalid items by type
 * @returns {Object} - Statistics object
 */
const generateStats = (filesByType, parsedItemsByType, validItemsByType, invalidItemsByType) => {
  const stats = {
    types: Object.keys(filesByType),
    processedAt: new Date().toISOString(),
    version: "1.0.0"
  };

  for (const type of Object.keys(filesByType)) {
    const fileCount = filesByType[type] ? filesByType[type].length : 0;
    const parsedCount = parsedItemsByType[type] ? parsedItemsByType[type].length : 0;
    const validCount = validItemsByType[type] ? validItemsByType[type].length : 0;
    const invalidCount = invalidItemsByType[type] ? invalidItemsByType[type].length : 0;

    stats[`${type}Files`] = fileCount;
    stats[`${type}Parsed`] = parsedCount;
    stats[`${type}Valid`] = validCount;
    stats[`${type}Invalid`] = invalidCount;
  }

  return stats;
};

/**
 * Build final data structure
 * @param {Object} validItemsByType - Valid items by type
 * @param {Object} stats - Processing statistics
 * @returns {Object} - Final data structure
 */
const buildFinalDataStructure = (validItemsByType, stats) => {
  const completeData = { stats };

  // Add each content type alphabetically
  for (const type of Object.keys(validItemsByType)) {
    completeData[type] = validItemsByType[type];
  }

  // Generate FAQ list data from VALID FAQs only
  if (completeData.faq && completeData.faq.length > 0) {
    completeData.faqListData = generateFaqListData(completeData.faq);
  }

  return completeData;
};

/**
 * Generate FAQ list template data from valid FAQ items
 * @param {Array} faqItems - Valid FAQ items only
 * @returns {Array} - FAQ list data organized by category
 */
const generateFaqListData = (faqItems) => {
  // Extract categories from valid FAQs only
  const categories = [...new Set(faqItems.map(faq => faq.category))].sort();

  return categories.map(category => {
    const questionsInCategory = faqItems.filter(faq => faq.category === category);

    return {
      category,
      categoryTitle: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      questions: questionsInCategory,
      hasQuestions: questionsInCategory.length > 0
    };
  }).filter(categoryData => categoryData.hasQuestions);
};


// =============================================================================
// LOGGING FUNCTIONS (IMPURE)
// =============================================================================

/**
 * Log discovery phase information
 * @param {Object} filesByType - Files by type
 * @param {Function} logger - Logger function
 */
const logDiscovery = (filesByType, logger) => {
  const totalFiles = Object.values(filesByType).reduce((total, files) => total + files.length, 0);
  const typeNames = Object.keys(filesByType);

  logger(`    📄 Found ${totalFiles} markdown files in ${typeNames.length} types: ${typeNames.join(', ')}`);
};

/**
 * Log parsing phase information
 * @param {Object} parsedItemsByType - Parsed items by type
 * @param {Function} logger - Logger function
 */
const logParsing = (parsedItemsByType, logger) => {
  for (const type of Object.keys(parsedItemsByType)) {
    logger(`    ✅ Parsed ${parsedItemsByType[type].length} ${type} items`);
  }
};

// =============================================================================
// MAIN PROCESSOR PIPELINE
// =============================================================================

/**
 * Main content processing pipeline
 * @returns {Object} - Processed content data
 */
module.exports = function () {
  const projectRoot = path.join(__dirname, "..", "..");

  // Clear validation log at start of build
  clearValidationLog();

  // Get configured content types
  console.log(`📋 Processing configured content types: ${CONTENT_TYPE_NAMES.join(', ')}`);

  // Create parser registry from configuration
  const parserRegistry = createParserRegistry();

  const processor = createContentProcessor({ parserRegistry });

  console.log("🚀 Starting unified content processing...");

  // Phase 1: Discovery (I/O)
  console.log("📁 Walking configured content directories...");
  const filesByType = processor.walkConfiguredDirectories(projectRoot, CONTENT_TYPE_NAMES, getSourceDirectory);
  logDiscovery(filesByType, console.log);

  // Phase 2: Parsing (Two-phase approach)
  console.log("📝 Parsing markdown files...");
  const parsedItemsByType = parseAllContentTypes(
    filesByType,
    processor.parseBaseMarkdown,
    processor.getEnhancer,
    processor.readFileContent
  );
  logParsing(parsedItemsByType, console.log);

  // Phase 3: Post-processing
  console.log("🔧 Post-processing specialized content types...");
  const postProcessedItems = applyPostProcessing(
    parsedItemsByType,
    processor.getPostProcessor
  );

  // Phase 4: Validation
  console.log("🔍 Validating content against schemas...");
  console.log("    📄 Validation errors logged in ./validation-errors.log");
  const { valid: validItemsByType, invalid: invalidItemsByType } = validateAllContentTypes(
    postProcessedItems,
    processor.validateAndFilterContent
  );

  // Phase 5: Statistics generation
  console.log("📊 Generating metadata...");
  const stats = generateStats(filesByType, parsedItemsByType, validItemsByType, invalidItemsByType);

  // Phase 6: Final data structure assembly
  const finalData = buildFinalDataStructure(validItemsByType, stats);

  console.log("🎉 Unified content processing complete!");

  return finalData;
};
