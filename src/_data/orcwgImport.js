const path = require("path");
const { createContentProcessor } = require("../lib/contentProcessor");

// =============================================================================
// PURE PIPELINE FUNCTIONS
// =============================================================================

/**
 * Pure function to calculate total files across types
 * @param {Object} filesByType - Files organized by type
 * @returns {number} - Total file count
 */
const calculateTotalFiles = (filesByType) => {
  return Object.values(filesByType).reduce((total, files) => total + files.length, 0);
};

/**
 * Pure function to get sorted type names
 * @param {Object} filesByType - Files by type
 * @returns {Array} - Sorted type names
 */
const getSortedTypeNames = (filesByType) => {
  return Object.keys(filesByType).sort();
};

/**
 * Pure function to parse files for a single content type
 * @param {Array} files - Files to parse
 * @param {Function} parser - Parser function
 * @param {Function} fileReader - File reading function
 * @param {string} contentType - Content type for URL generation
 * @returns {Array} - Parsed items
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
 * Pure function to parse all content types
 * @param {Object} filesByType - Files by type
 * @param {Function} getParser - Parser getter function
 * @param {Function} fileReader - File reader function
 * @returns {Object} - Parsed items by type
 */
const parseAllContentTypes = (filesByType, getParser, fileReader) => {
  const parsedItemsByType = {};

  for (const type in filesByType) {
    const parser = getParser(type);
    parsedItemsByType[type] = parseFilesForType(filesByType[type], parser, fileReader, type);
  }

  return parsedItemsByType;
};

/**
 * Pure function to apply post-processing to all types
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
 * Pure function to validate all content types
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
 * Pure function to generate processing statistics
 * @param {Object} filesByType - Files by type
 * @param {Object} parsedItemsByType - Parsed items by type
 * @param {Object} validItemsByType - Valid items by type
 * @param {Object} invalidItemsByType - Invalid items by type
 * @returns {Object} - Statistics object
 */
const generateStats = (filesByType, parsedItemsByType, validItemsByType, invalidItemsByType) => {
  const stats = {
    types: getSortedTypeNames(filesByType),
    processedAt: new Date().toISOString(),
    version: "1.0.0"
  };

  for (const type of getSortedTypeNames(filesByType)) {
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
 * Pure function to build final data structure
 * @param {Object} validItemsByType - Valid items by type
 * @param {Object} stats - Processing statistics
 * @returns {Object} - Final data structure
 */
const buildFinalDataStructure = (validItemsByType, stats) => {
  const completeData = { stats };

  // Add each content type alphabetically
  for (const type of getSortedTypeNames(validItemsByType)) {
    completeData[type] = validItemsByType[type];
  }

  return completeData;
};

/**
 * Pure function to add backward compatibility data
 * @param {Object} completeData - Complete data structure
 * @returns {Object} - Data with backward compatibility additions
 */
const addBackwardCompatibility = (completeData) => {
  const result = { ...completeData };

  // Extract categories from FAQ data for backward compatibility
  if (result.faq) {
    const categoriesWithFaqs = new Set();
    result.faq.forEach(faq => categoriesWithFaqs.add(faq.category));
    result.categoryList = Array.from(categoriesWithFaqs).sort();

    // Pre-compute FAQ list template data
    result.faqListData = generateFaqListData(result.faq, result.categoryList);
  }

  return result;
};

/**
 * Pure function to generate FAQ list template data
 * @param {Array} faqs - FAQ items
 * @param {Array} categories - Category list
 * @returns {Array} - FAQ list data organized by category
 */
const generateFaqListData = (faqs, categories) => {
  return categories.map(category => {
    const questionsInCategory = faqs.filter(faq => faq.category === category);

    return {
      category,
      categoryTitle: category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      questions: questionsInCategory.map(question => ({
        ...question,
        templateData: computeFaqListItemData(question)
      })),
      hasQuestions: questionsInCategory.length > 0
    };
  }).filter(categoryData => categoryData.hasQuestions);
};

/**
 * Pre-compute template data for individual FAQ list items
 * @param {Object} question - FAQ item
 * @returns {Object} - Template data
 */
const computeFaqListItemData = (question) => {
  return {
    hasQuestion: !!question.question,
    questionText: question.question || question.filename.replace('.md', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    url: `/faq/${question.category}/${question.filename.replace('.md', '')}/`,
    statusData: computeStatusData(question),
    hasMissingContent: (!question.question || !question.answer || question.answer.length === 0)
  };
};

/**
 * Pre-compute status data for FAQ items
 * @param {Object} question - FAQ item
 * @returns {Object} - Status data
 */
const computeStatusData = (question) => {
  const status = question.Status;

  if (!status) {
    return { hasStatus: false };
  }

  const statusMappings = {
    'draft': { emoji: '⚠️', label: 'Draft', class: 'status-draft' },
    'pending-guidance': { emoji: '🛑', label: 'Pending Guidance', class: 'status-pending-guidance' },
    'approved': { emoji: '✅', label: 'Approved', class: 'status-approved' }
  };

  const mapping = statusMappings[status];

  return {
    hasStatus: true,
    status,
    emoji: mapping ? mapping.emoji : '',
    label: mapping ? mapping.label : status,
    cssClass: mapping ? mapping.class : 'status-unknown'
  };
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
  const totalFiles = calculateTotalFiles(filesByType);
  const typeNames = getSortedTypeNames(filesByType);

  logger(`    📄 Found ${totalFiles} markdown files in ${typeNames.length} types: ${typeNames.join(', ')}`);
};

/**
 * Log parsing phase information
 * @param {Object} parsedItemsByType - Parsed items by type
 * @param {Function} logger - Logger function
 */
const logParsing = (parsedItemsByType, logger) => {
  for (const type of getSortedTypeNames(parsedItemsByType)) {
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
  const cacheDir = path.join(__dirname, "..", "..", "_cache");

  // Create parser registry with specialized parsers
  const parserConfigs = [
    { name: "faq", path: "../lib/types/faq" },
    { name: "lists", path: "../lib/types/lists" },
    { name: "guidance", path: "../lib/types/guidance" }
  ];

  const parserRegistry = {};
  parserConfigs.forEach(({ name, path: modulePath }) => {
    try {
      const parser = require(modulePath);
      parserRegistry[name] = parser;
    } catch (error) {
      // Parser not available, continue without it
    }
  });

  const processor = createContentProcessor({ parserRegistry });

  console.log("🚀 Starting unified content processing...");

  // Phase 1: Discovery (I/O)
  console.log("📁 Walking directory structure...");
  const filesByType = processor.walkAllFiles(cacheDir);
  logDiscovery(filesByType, console.log);

  // Phase 2: Parsing (I/O + Pure)
  console.log("📝 Parsing markdown files...");
  const parsedItemsByType = parseAllContentTypes(
    filesByType,
    processor.getParser,
    processor.readFileContent
  );
  logParsing(parsedItemsByType, console.log);

  // Phase 3: Post-processing (Pure)
  console.log("🔧 Post-processing specialized content types...");
  const postProcessedItems = applyPostProcessing(
    parsedItemsByType,
    processor.getPostProcessor
  );

  // Phase 4: Validation (Pure + I/O for logging)
  console.log("🔍 Validating content against schemas...");
  const { valid: validItemsByType, invalid: invalidItemsByType } = validateAllContentTypes(
    postProcessedItems,
    processor.validateAndFilterContent
  );

  // Phase 5: Statistics generation (Pure)
  console.log("📊 Generating metadata...");
  const stats = generateStats(filesByType, parsedItemsByType, validItemsByType, invalidItemsByType);

  // Phase 6: Final data structure assembly (Pure)
  const completeData = buildFinalDataStructure(validItemsByType, stats);
  const finalData = addBackwardCompatibility(completeData);

  console.log("🎉 Unified content processing complete!");

  return finalData;
};
