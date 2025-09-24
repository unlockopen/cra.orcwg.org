const fs = require("fs");
const path = require("path");
const { processAllContent } = require('./contentProcessor');

const OUTPUT_DIR = path.join(__dirname, "..", "..", "_tmp");

module.exports = function () {
  const content = processAllContent();

  // Write to _tmp/faq.json for debugging/inspection
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(OUTPUT_DIR, "faq.json"),
      JSON.stringify(content.faqsByCategory, null, 2),
      "utf-8"
    );
    console.log("✅ Wrote faq.json to _tmp/");
  } catch (err) {
    console.error("⚠️ Could not write faq.json:", err);
  }

  return content;
};