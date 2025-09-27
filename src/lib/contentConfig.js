/**
 * Content Types Configuration
 *
 * Explicit configuration for all content types, their parsers, schemas, and source directories.
 * This replaces the autodetection system with explicit configuration.
 */

const path = require('path');

/**
 * Configuration for each content type
 * - sourceDir: Directory where raw content files are located (relative to project root)
 * - parserPath: Path to the parser module for this content type if it needs special handling
 * - schemaPath: Path to the JSON schema file for validation
 */
const CONTENT_TYPES = {
  // Frequently Asked Questions
  faq: {
    sourceDir: '_cache/faq',
    parserPath: '../lib/parsers/faq',
    schemaPath: '../lib/schemas/faq.json',
  },
  // Guidance requests
  guidance: {
    sourceDir: '_cache/faq/pending-guidance',
    parserPath: '../lib/parsers/guidance',
    schemaPath: '../lib/schemas/guidance.json',
  },
  // Curated lists of related FAQ items
  list: {
    sourceDir: 'src/_lists',
    parserPath: '../lib/parsers/list',
    schemaPath: '../lib/schemas/list.json',
  }
};

const CONTENT_TYPE_NAMES = Object.keys(CONTENT_TYPES);

/**
 * Get source directory path for a content type
 * @param {string} typeName - Content type name
 * @param {string} projectRoot - Project root directory (used for relative paths)
 * @returns {string|null} Full path to source directory or null if not found
 */
function getSourceDirectory(typeName, projectRoot) {
  const config = CONTENT_TYPES[typeName];
  if (!config) return null;

  // If sourceDir is absolute, use it as-is; otherwise resolve relative to project root
  return path.isAbsolute(config.sourceDir)
    ? config.sourceDir
    : path.join(projectRoot, config.sourceDir);
}

/**
 * Create parser registry from configuration
 * @param {Function} moduleLoader - Module loader function (required)
 * @param {Object} contentTypes - Content type configurations (required)
 * @returns {Object} Parser registry with all configured parsers
 */
function createParserRegistry(moduleLoader, contentTypes) {
  if (!moduleLoader) {
    throw new Error('moduleLoader parameter is required');
  }
  if (!contentTypes) {
    throw new Error('contentTypes parameter is required');
  }

  const registry = {};

  for (const typeName of Object.keys(contentTypes)) {
    const config = contentTypes[typeName];
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
  CONTENT_TYPE_NAMES,
  getSourceDirectory,
  createParserRegistry
};
