const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

function extractGuidanceText(content) {
  if (!content) return "";

  const lines = content.split('\n');
  let isInGuidanceSection = false;
  let shouldStop = false;
  let guidanceLines = [];

  lines.forEach(line => {
    if (shouldStop) return;

    const trimmedLine = line.trim();

    // Check if we're entering the "Guidance Needed" section
    if (trimmedLine.match(/^#+\s*Guidance Needed/i)) {
      isInGuidanceSection = true;
      return;
    }

    // Check if we're entering another section (any heading)
    if (isInGuidanceSection && trimmedLine.match(/^#+\s/)) {
      shouldStop = true;
      return;
    }

    // Collect lines while in the guidance section
    if (isInGuidanceSection && trimmedLine) {
      guidanceLines.push(trimmedLine);
    }
  });

  // Join the guidance text and process markdown
  const rawText = guidanceLines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Convert markdown to HTML and then strip HTML tags for clean text
  if (rawText) {
    const markdownIt = require("markdown-it")();
    const htmlContent = markdownIt.render(rawText);
    return htmlContent.replace(/<[^>]*>/g, "").trim();
  }

  return "";
}

const CACHE_DIR = path.join(__dirname, "..", "..", "_cache", "faq");

function walkForPendingGuidance(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively walk subdirectories
      const subResult = walkForPendingGuidance(fullPath);
      result.push(...subResult);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = matter(raw);

      // Only include files with type: guidance-request
      if (parsed.data && parsed.data.type === 'guidance-request') {
        const content = parsed.content.trim();

        // Parse question from first # heading
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const question = titleMatch ? titleMatch[1] : null;

        // Everything after the first heading is the answer
        let answer = null;
        if (titleMatch) {
          const afterTitle = content.substring(content.indexOf(titleMatch[0]) + titleMatch[0].length).trim();
          answer = afterTitle;
        } else {
          // Fallback: treat entire content as answer if no title found
          answer = content;
        }

        result.push({
          filename: entry.name,
          data: parsed.data,
          question,
          answer,
          content: parsed.content,
          status: parsed.data.status,
          fullPath: fullPath
        });
      }
    }
  }

  return result;
}

module.exports = function () {
  const pendingGuidance = walkForPendingGuidance(CACHE_DIR);

  // Add related FAQ information
  const faq = require('./faq.js')();

  return pendingGuidance.map(guidance => {
    // Find all related FAQs that reference this guidance
    const relatedFaqs = [];
    const guidanceKey = guidance.filename.replace('.md', '');

    for (const [category, questions] of Object.entries(faq)) {
      for (const question of questions) {
        if (question['pending-guidance'] === guidanceKey) {
          relatedFaqs.push({
            category,
            filename: question.filename,
            question: question.question
          });
        }
      }
    }

    // Extract title from content if not in frontmatter
    let title = guidance.data.title || guidance.question;
    if (!title && guidance.content) {
      const titleMatch = guidance.content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1];
      }
    }
    if (!title) {
      // Fallback to filename
      title = guidance.filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return {
      ...guidance,
      title,
      relatedFaqs,
      relatedFaq: relatedFaqs[0] || null, // Keep for backward compatibility
      guidanceText: extractGuidanceText(guidance.content)
    };
  });
};