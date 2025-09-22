const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const CACHE_DIR = path.join(__dirname, "..", "..", "_cache", "faq");
const OUTPUT_DIR = path.join(__dirname, "..", "..", "_tmp"); // where Eleventy outputs final site

function walk(dir, category = "") {
  const result = {};
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively walk subdirectories
      const subResult = walk(fullPath, entry.name);
      Object.assign(result, subResult);

    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = matter(raw);

      // Skip files with no gray-matter
      if (!parsed.data || Object.keys(parsed.data).length === 0) {
        continue;
      }

      // Skip pending guidance files
      if (parsed.data.type === 'guidance-request') {
        continue;
      }

      if (!result[category]) {
        result[category] = [];
      }

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

      // Normalize status based on pending guidance
      let status = parsed.data.Status;
      if (parsed.data['pending-guidance']) {
        status = 'pending-guidance';
      } else if (status) {
        // Clean up status - remove emoji and normalize
        status = status.replace(/⚠️\s*/, '').trim();
        // Only keep draft or approved, default others to approved
        if (status.toLowerCase().includes('draft')) {
          status = 'draft';
        } else {
          status = 'approved';
        }
      } else {
        status = 'approved';
      }

      result[category].push({
        filename: entry.name,
        ...parsed.data,
        Status: status,
        question,
        answer
      });
    }
  }

  return result;
}

module.exports = function () {
  const faqs = walk(CACHE_DIR);

  // 🔥 Write to _tmp/faq.json
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "faq.json"),
      JSON.stringify(faqs, null, 2),
      "utf-8"
    );
    console.log("✅ Wrote faq.json to _tmp/");
  } catch (err) {
    console.error("⚠️ Could not write faq.json:", err);
  }

  // Return flattened array to Eleventy
  return faqs;
};
