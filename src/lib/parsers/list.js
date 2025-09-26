const path = require("path");

/**
 * Specialized parser for lists directory items
 */

/**
 * Extract title from markdown content
 * @param {string} content - Raw markdown content
 * @returns {string|null} - Extracted title or null
 */
function extractTitle(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1] : null;
}

/**
 * Extract description from markdown content (content after title)
 * @param {string} content - Raw markdown content
 * @param {Object} titleMatch - Title match object
 * @returns {string} - Extracted description
 */
function extractDescription(content, titleMatch) {
  if (titleMatch) {
    const afterTitle = content.substring(
      content.indexOf(titleMatch[0]) + titleMatch[0].length
    ).trim();
    return afterTitle;
  }
  return content;
}

/**
 * Pure list enhancer - adds list-specific fields to base item
 * @param {Object} baseItem - Base item from parseBaseMarkdown
 * @returns {Object} - Enhanced list item
 */
function enhanceListItem(baseItem) {
    // Extract lists-specific semantic content
    const title = extractTitle(baseItem.rawMarkdown);
    const description = extractDescription(baseItem.rawMarkdown, baseItem.rawMarkdown.match(/^#\s+(.+)$/m));

    const computedTitle = title || baseItem.title || baseItem.filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return {
        ...baseItem,
        title: computedTitle,
        description: description || baseItem.rawMarkdown,
        order: baseItem.order ? parseInt(baseItem.order, 10) : 999,
        faqs: baseItem.faqs || []
    };
}


/**
 * Post-process list items after basic parsing
 * @param {Array} listItems - Array of parsed list items
 * @param {Object} allParsedData - All parsed data by type for cross-referencing
 * @returns {Array} - Array of processed list items
 */
function postProcessList(listItems, allParsedData) {
    // No post-processing needed - templates can look up FAQs directly
    return listItems;
}


module.exports = {
    enhanceListItem,
    postProcessList
};
