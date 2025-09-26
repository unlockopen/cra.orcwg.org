/**
 * Specialized parser for guidance pages
 * Extracts and processes guidance-specific semantic content
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
 * Extract answer/body from markdown content (content after title)
 * @param {string} content - Raw markdown content
 * @param {Object} titleMatch - Title match object
 * @returns {string} - Extracted answer/body
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
 * Extract summary from "Guidance needed" section
 * @param {string} content - Raw markdown content
 * @returns {string} - Extracted guidance summary
 */
function extractGuidanceSummary(content) {
    if (!content) return "";

    const lines = content.split('\n');
    let isInGuidanceSection = false;
    let guidanceLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Check if we're entering the "Guidance needed" section
        if (line.match(/^#+\s*Guidance [Nn]eeded/i)) {
            isInGuidanceSection = true;
            continue;
        }

        // Check if we're entering another section (any heading)
        if (isInGuidanceSection && line.match(/^#+\s/)) {
            break; // Stop when we hit the next heading
        }

        // Collect lines while in the guidance section
        if (isInGuidanceSection && line) {
            guidanceLines.push(line);
        }
    }

    // Join the guidance text and process markdown
    const rawText = guidanceLines
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Convert markdown to HTML and then strip HTML tags for clean text
    if (rawText) {
        try {
            const markdownIt = require("markdown-it")();
            const htmlContent = markdownIt.render(rawText);
            return htmlContent.replace(/<[^>]*>/g, "").trim();
        } catch (error) {
            // Fallback if markdown-it is not available
            return rawText;
        }
    }

    return rawText;
}

/**
 * Pure guidance enhancer - adds minimal guidance-specific fields
 * @param {Object} baseItem - Base item from parseBaseMarkdown
 * @returns {Object} - Clean enhanced guidance item
 */
function enhanceGuidanceItem(baseItem) {
    // Extract minimal guidance-specific semantic content
    const title = extractTitle(baseItem.rawMarkdown);
    const summary = extractGuidanceSummary(baseItem.rawMarkdown);

    return {
        ...baseItem,
        // Only essential guidance fields
        title: title || baseItem.title || baseItem.filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        summary
    };
}

/**
 * Convert guidance array to keyed object structure
 * @param {Array} guidanceItems - Array of processed guidance items
 * @returns {Object} - Keyed guidance object wrapped for proper assignment
 */
function buildGuidanceStructure(guidanceItems) {
    if (!guidanceItems || guidanceItems.length === 0) {
        return { guidance: {} };
    }

    const guidance = {};

    guidanceItems.forEach(guidanceItem => {
        const guidanceKey = guidanceItem.filename.replace('.md', '');
        guidance[guidanceKey] = guidanceItem;
    });

    return { guidance };
}

module.exports = {
    enhanceGuidanceItem,
    buildStructure: buildGuidanceStructure
};
