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
 * @returns {string} - Extracted answer
 */
function extractAnswer(content, titleMatch) {
  if (titleMatch) {
    const afterTitle = content.substring(
      content.indexOf(titleMatch[0]) + titleMatch[0].length
    ).trim();
    return afterTitle;
  }
  return content;
}

/**
 * Custom parser for FAQ markdown files
 * @param {Object} fileContent - Raw file content from readFileContent
 * @param {string} filename - The filename
 * @param {string} category - The category/directory
 * @param {string} contentType - Content type for URL generation
 * @returns {Object|null} - Parsed FAQ item or null if invalid
 */
function parseFaqMarkdown(fileContent, filename, category, contentType) {
    const { parseMarkdown } = require("../contentProcessor");

    // Start with base parsing
    const baseItem = parseMarkdown(fileContent, filename, category, contentType);
    if (!baseItem) return null;

    // Extract FAQ-specific semantic content
    const question = extractQuestion(baseItem.rawContent);
    const titleMatch = baseItem.rawContent.match(/^#\s+(.+)$/m);
    const answer = extractAnswer(baseItem.rawContent, titleMatch);

    return {
        ...baseItem,
        // FAQ-specific semantic fields
        question,
        answer,
        // Keep raw content for reference
        content: baseItem.rawContent,
        // Flatten frontmatter data to top level for backward compatibility
        ...baseItem.data
    };
}

/**
 * Post-process FAQ items after parsing
 * Handles enrichment with guidance and related FAQs
 * @param {Array} faqItems - Array of parsed FAQ items
 * @param {Object} allParsedData - All parsed data by type for cross-referencing
 * @returns {Array} - Array of enriched FAQ items
 */
function postProcessFaq(faqItems, allParsedData) {
    const { enrichFaqsWithGuidance, enrichGuidanceWithFaqs } = require("../contentProcessor");

    const guidanceItems = allParsedData.guidance || [];

    // Step 1: Enrich FAQs with guidance references
    const enrichedFaqs = enrichFaqsWithGuidance(faqItems, guidanceItems);

    // Step 2: Add computed template properties
    const faqsWithTemplateData = enrichedFaqs.map(faq => ({
        ...faq,
        // Pre-compute guidance data for templates
        guidanceData: computeGuidanceData(faq, guidanceItems),
        // Pre-compute admin data
        adminData: computeAdminData(faq)
    }));

    // Step 3: Enrich guidance with related FAQs (bidirectional linking)
    const enrichedGuidance = enrichGuidanceWithFaqs(guidanceItems, faqsWithTemplateData);

    // Update the guidance in the parsed data for other processors to use
    if (allParsedData.guidance) {
        allParsedData.guidance = enrichedGuidance;
    }

    return faqsWithTemplateData;
}

/**
 * Pre-compute guidance data for FAQ templates
 * @param {Object} faq - FAQ item
 * @param {Array} guidanceItems - Array of guidance items
 * @returns {Object|null} - Guidance data or null
 */
function computeGuidanceData(faq, guidanceItems) {
    const isPendingGuidance = (faq.Status === "pending-guidance") || faq["pending-guidance"] || faq["guidance-id"];

    if (!isPendingGuidance) {
        return null;
    }

    const guidanceKey = faq["pending-guidance"] || faq["guidance-id"];
    if (!guidanceKey) {
        return { hasPendingGuidance: true };
    }

    const guidanceItem = guidanceItems.find(g => g.filename === guidanceKey + ".md");
    if (!guidanceItem) {
        return { hasPendingGuidance: true };
    }

    return {
        hasPendingGuidance: true,
        guidanceKey,
        guidanceNeeded: guidanceItem.guidanceNeeded,
        hasSpecificGuidance: !!guidanceItem.guidanceNeeded,
        guidanceUrl: `/pending-guidance/${guidanceKey}/`
    };
}

/**
 * Pre-compute admin data for FAQ templates
 * @param {Object} faq - FAQ item
 * @returns {Object} - Admin data
 */
function computeAdminData(faq) {
    const guidanceKey = faq["pending-guidance"] || faq["guidance-id"];

    return {
        hasGuidance: !!guidanceKey,
        guidanceKey,
        guidanceTitle: guidanceKey ? guidanceKey.replace('-', ' ').replace(/\w\S*/g, (txt) =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        ) : null,
        guidanceUrl: guidanceKey ? `/pending-guidance/${guidanceKey}/` : null,
        hasRelatedIssue: !!faq["Related issue"],
        relatedIssue: faq["Related issue"],
        githubEditUrl: `https://github.com/orcwg/cra-hub/edit/main/faq/${faq.category}/${faq.filename}`
    };
}

module.exports = {
    parseFaqMarkdown,
    postProcessFaq
};