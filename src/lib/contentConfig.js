/**
 * Content Types Configuration
 *
 * Explicit configuration for all content types, their parsers, schemas, and source directories.
 * This replaces the autodetection system with explicit configuration.
 */

const path = require('path');

/**
 * Configuration for each content type
 */
const CONTENT_TYPES = {
  // Frequently Asked Questions
  faq: {
    sourceDir: 'faq',
    parserPath: '../lib/types/faq',
    schemaPath: '../lib/schemas/faq.json',
  },
  // Guidance requests
  guidance: {
    sourceDir: 'guidance',
    parserPath: '../lib/types/guidance',
    schemaPath: '../lib/schemas/guidance.json',
  },
  // Curated lists of related FAQ items
  lists: {
    sourceDir: 'lists',
    parserPath: '../lib/types/lists',
    schemaPath: '../lib/schemas/lists.json',
  }
};

/**
 * Get all configured content types
 * @returns {Array} Array of content type names
 */
function getContentTypeNames() {
  return Object.keys(CONTENT_TYPES);
}


/**
 * Get source directory path for a content type
 * @param {string} typeName - Content type name
 * @param {string} baseDir - Base cache directory
 * @returns {string|null} Full path to source directory or null if not found
 */
function getSourceDirectory(typeName, baseDir) {
  const config = CONTENT_TYPES[typeName];
  if (!config) return null;

  return path.join(baseDir, config.sourceDir);
}

/**
 * Create parser registry from configuration
 * @param {Function} moduleLoader - Module loader function (for testing)
 * @returns {Object} Parser registry with all configured parsers
 */
function createParserRegistry(moduleLoader = require) {
  const registry = {};

  for (const typeName of getContentTypeNames()) {
    const config = CONTENT_TYPES[typeName];
    if (!config) continue;

    try {
      const parser = moduleLoader(config.parserPath);
      if (parser) {
        registry[typeName] = parser;
      }
    } catch (error) {
      console.warn(`Failed to load parser for ${typeName}:`, error.message);
    }
  }

  return registry;
}

module.exports = {
  CONTENT_TYPES,
  getContentTypeNames,
  getSourceDirectory,
  createParserRegistry
};
