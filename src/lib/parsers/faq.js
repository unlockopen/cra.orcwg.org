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
    const question = extractQuestion(baseItem.rawContent);
    const titleMatch = baseItem.rawContent.match(/^#\s+(.+)$/m);
    const answer = extractAnswer(baseItem.rawContent, titleMatch);

    // Build result immutably - include answer only if it exists
    return {
        ...baseItem,
        // FAQ-specific semantic fields
        question,
        // Keep raw content for reference
        content: baseItem.rawContent,
        // Only add answer field if there's actual content
        ...(answer !== null && { answer })
    };
}


/**
 * Post-process FAQ items after parsing
 * Handles enrichment with guidance and related FAQs
 * @param {Array} faqItems - Array of parsed FAQ items
 * @param {Object} allParsedData - All parsed data by type for cross-referencing
 * @returns {Object} - Object with FAQ items and additional computed data
 *
 * NOTE: This function intentionally mutates allParsedData.guidance for cross-referencing.
 * This is a design compromise for bidirectional linking between content types.
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
        adminData: computeAdminData(faq),
        // Add FAQ list template data
        templateData: computeFaqListItemData(faq)
    }));

    // Step 3: Enrich guidance with related FAQs (bidirectional linking)
    const enrichedGuidance = enrichGuidanceWithFaqs(guidanceItems, faqsWithTemplateData);

    // MUTATION: Update guidance for cross-referencing (design compromise)
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
        summary: guidanceItem.summary,
        hasSpecificGuidance: !!guidanceItem.summary,
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

/**
 * Pre-compute template data for individual FAQ list items
 * @param {Object} question - FAQ item
 * @returns {Object} - Template data
 */
function computeFaqListItemData(question) {
    return {
        hasQuestion: !!question.question,
        questionText: question.question || question.filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        url: question.url,
        statusData: computeStatusData(question),
        hasMissingContent: (!question.question || !question.answer || question.answer.length === 0)
    };
}

/**
 * Compute status data for FAQ items
 * @param {Object} question - FAQ item
 * @returns {Object} - Status data
 */
function computeStatusData(question) {
    const status = question.Status;

    if (!status) {
        return { hasStatus: false };
    }

    const statusMappings = {
        'draft': { emoji: '⚠️', label: 'Draft', class: 'status-draft' },
        'pending-guidance': { emoji: '🛑', label: 'Pending Guidance', class: 'status-pending-guidance' },
        'approved': { emoji: '✅', label: 'Approved', class: 'status-approved' }
    };

    const mapping = statusMappings[status.toLowerCase()];

    return {
        hasStatus: true,
        status,
        emoji: mapping ? mapping.emoji : '',
        label: mapping ? mapping.label : status,
        cssClass: mapping ? mapping.class : 'status-unknown'
    };
}


module.exports = {
    enhanceFaqItem,
    postProcessFaq
};