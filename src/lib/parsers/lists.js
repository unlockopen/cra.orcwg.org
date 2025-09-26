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
 * Pure lists enhancer - adds lists-specific fields to base item
 * @param {Object} baseItem - Base item from parseBaseMarkdown
 * @returns {Object} - Enhanced lists item
 */
function enhanceListsItem(baseItem) {
    // Extract lists-specific semantic content
    const titleMatch = baseItem.rawMarkdown.match(/^#\s+(.+)$/m);
    const title = extractTitle(baseItem.rawMarkdown);
    const description = extractDescription(baseItem.rawMarkdown, titleMatch);

    const computedTitle = title || baseItem.title || baseItem.filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const computedDescription = description || '';

    return {
        ...baseItem,
        // Lists-specific semantic fields
        title: computedTitle,
        description: computedDescription,
        order: baseItem.order ? parseInt(baseItem.order, 10) : 999,
        faqs: baseItem.faqs || [],
        // Keep raw content for reference
        content: baseItem.rawMarkdown,
        // Legacy compatibility - some templates may expect these
        question: title,
        answer: computedDescription,
        // Initialize empty items array that will be populated in post-processing
        items: []
    };
}


/**
 * Post-process lists items after basic parsing
 * Resolves FAQ references and builds item arrays
 * @param {Array} listItems - Array of parsed list items
 * @param {Object} allParsedData - All parsed data by type for cross-referencing
 * @returns {Array} - Array of processed list items
 */
function postProcessLists(listItems, allParsedData) {
    // Create flat FAQ store from the parsed FAQ data
    const flatFaqStore = {};
    const faqItems = allParsedData.faq || [];
    faqItems.forEach(faq => {
        const faqKey = `${faq.category}/${faq.filename.replace('.md', '')}`;
        flatFaqStore[faqKey] = faq;
    });

    return listItems.map(listItem => {
        const items = [];

        if (listItem.faqs) {
            for (const faqKey of listItem.faqs) {
                const faq = flatFaqStore[faqKey];
                if (faq) {
                    items.push({
                        question: faq.question,
                        url: faq.url
                    });
                }
            }
        }

        return {
            ...listItem,
            items,
            // Pre-compute template data
            templateData: computeListTemplateData(listItem, items)
        };
    });
}

/**
 * Pre-compute template data for list items
 * @param {Object} listItem - List item data
 * @param {Array} items - FAQ items in the list
 * @returns {Object} - Template data
 */
function computeListTemplateData(listItem, items) {
    return {
        description: listItem.description || listItem.answer
    };
}

module.exports = {
    enhanceListsItem,
    postProcessLists
};
