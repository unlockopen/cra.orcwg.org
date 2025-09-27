/**
 * Specialized parser for FAQ directory items
 * Handles FAQ semantic extraction and enrichment
 */

/**
 * Extract question from markdown content
 * @param {string} content - Raw markdown content
 * @returns {string|null} - Extracted question or null
 */
function extractQuestion(content) {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1] : null;
}

/**
 * Extract answer from markdown content
 * @param {string} content - Raw markdown content
 * @param {Object} titleMatch - Title match object
 * @returns {string|null} - Extracted answer or null if empty
 */
function extractAnswer(content, titleMatch) {
  let answer;
  if (titleMatch) {
    const afterTitle = content.substring(
      content.indexOf(titleMatch[0]) + titleMatch[0].length
    ).trim();
    answer = afterTitle;
  } else {
    answer = content.trim();
  }

  // Return null for empty answers instead of empty string
  return answer === '' ? null : answer;
}

/**
 * Pure FAQ enhancer - adds FAQ-specific fields to base item
 * @param {Object} baseItem - Base item from parseBaseMarkdown
 * @returns {Object} - Enhanced FAQ item with question/answer
 */
function enhanceFaqItem(baseItem) {
    // Extract FAQ-specific semantic content
    const question = extractQuestion(baseItem.rawMarkdown);
    const titleMatch = baseItem.rawMarkdown.match(/^#\s+(.+)$/m);
    const answer = extractAnswer(baseItem.rawMarkdown, titleMatch);

    // Build result immutably - include answer only if it exists
    return {
        ...baseItem,
        // FAQ-specific semantic fields
        question,
        // Only add answer field if there's actual content
        ...(answer !== null && { answer })
    };
}


/**
 * Post-process FAQ items after parsing
 * Pure function - no cross-referencing mutations
 * @param {Array} faqItems - Array of parsed FAQ items
 * @param {Object} allParsedData - All parsed data by type (unused now)
 * @returns {Array} - Clean FAQ items with minimal computed fields
 */
function postProcessFaq(faqItems, allParsedData) {
    // Return clean FAQs with minimal computed fields
    return faqItems.map(faq => {
        const guidanceKey = faq['guidance-id'];

        return {
            ...faq,
            // Only add guidance key if it exists - no other cross-reference data
            ...(guidanceKey && { guidanceKey }),
            // Only add GitHub URL - templates can compute the rest
            githubEditUrl: `https://github.com/orcwg/cra-hub/edit/main/faq/${faq.category}/${faq.filename}`
        };
    });
}

/**
 * Convert FAQ array to keyed object structure with categories
 * @param {Array} faqItems - Array of processed FAQ items
 * @returns {Object} - Object with faq lookup and categories structure
 */
function buildFaqStructure(faqItems) {
    if (!faqItems || faqItems.length === 0) {
        return {
            categories: {},
            faq: {}
        };
    }

    const categoriesWithFaqs = {};
    const faq = {};

    faqItems.forEach(faqItem => {
        const faqKey = `${faqItem.category}/${faqItem.filename.replace('.md', '')}`;

        // Build categories
        if (!categoriesWithFaqs[faqItem.category]) {
            categoriesWithFaqs[faqItem.category] = [];
        }
        categoriesWithFaqs[faqItem.category].push(faqKey);

        // Build FAQ lookup
        faq[faqKey] = faqItem;
    });

    return {
        categories: categoriesWithFaqs,
        faq
    };
}

/**
 * Create cross-reference links between FAQs and guidance
 * @param {Array} faqItems - Array of FAQ items
 * @returns {Object} - Cross-reference links
 */
function createFaqGuidanceCrossReferences(faqItems) {
    const faqGuidanceLinks = {};

    faqItems.forEach(faq => {
        const guidanceKey = faq.guidanceKey;
        if (guidanceKey) {
            if (!faqGuidanceLinks[guidanceKey]) {
                faqGuidanceLinks[guidanceKey] = [];
            }
            const faqKey = `${faq.category}/${faq.filename.replace('.md', '')}`;
            faqGuidanceLinks[guidanceKey].push(faqKey);
        }
    });

    return { faqGuidanceLinks };
}

module.exports = {
    enhanceFaqItem,
    postProcessFaq,
    buildStructure: buildFaqStructure,
    createCrossReferences: createFaqGuidanceCrossReferences
};