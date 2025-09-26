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
 * Extract guidance subject from "Guidance needed" section
 * @param {string} content - Raw markdown content
 * @returns {string} - Extracted guidance subject
 */
function extractGuidanceSubject(content) {
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
 * Custom parser for guidance markdown files
 * @param {Object} fileContent - Raw file content from readFileContent
 * @param {string} filename - The filename
 * @param {string} category - The category/directory
 * @param {string} contentType - Content type for URL generation
 * @returns {Object|null} - Parsed guidance item or null if invalid
 */
function parseGuidanceMarkdown(fileContent, filename, category, contentType) {
    const { parseMarkdown } = require("../contentProcessor");

    // Start with base parsing
    const baseItem = parseMarkdown(fileContent, filename, category, contentType);
    if (!baseItem) return null;

    // Extract guidance-specific semantic content
    const titleMatch = baseItem.rawContent.match(/^#\s+(.+)$/m);
    const title = extractTitle(baseItem.rawContent);
    const answer = extractAnswer(baseItem.rawContent, titleMatch);
    const guidanceSubject = extractGuidanceSubject(baseItem.rawContent);

    return {
        ...baseItem,
        // Guidance-specific semantic fields
        title: title || baseItem.data.title || filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        answer,
        guidanceSubject,
        // Legacy fields for backward compatibility
        guidanceNeeded: guidanceSubject,
        guidanceText: guidanceSubject,
        // Keep raw content for reference
        content: baseItem.rawContent,
        // Pre-compute template data
        templateData: computeGuidanceTemplateData(baseItem, filename)
    };
}

/**
 * Pre-compute template data for guidance items
 * @param {Object} baseItem - Base parsed item
 * @param {string} filename - The filename
 * @returns {Object} - Template data
 */
function computeGuidanceTemplateData(baseItem, filename) {
    return {
        hasRelatedIssue: !!baseItem.data && !!baseItem.data["Related issue"],
        relatedIssue: baseItem.data ? baseItem.data["Related issue"] : null,
        githubEditUrl: `https://github.com/orcwg/cra-hub/edit/main/faq/pending-guidance/${filename}`
    };
}

module.exports = {
    parseGuidanceMarkdown
};
