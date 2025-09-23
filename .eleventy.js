module.exports = function (eleventyConfig) {
  // Copy asset files to output
  eleventyConfig.addPassthroughCopy("src/assets");

  // Add markdown filter
  eleventyConfig.addFilter("markdown", function (content) {
    const markdownIt = require("markdown-it")();
    return markdownIt.render(content || "");
  });

  // Add category title filter
  eleventyConfig.addFilter("categoryTitle", function (category) {
    return category
      .replace(/-/g, ' ')
      .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  });

  // Add a filter to get object keys
  eleventyConfig.addFilter("getKeys", function(obj) {
    return Object.keys(obj);
  });

  // Add a filter to truncate text
  eleventyConfig.addFilter("truncate", function(text, length = 150) {
    if (text.length <= length) return text;
    return text.substr(0, length) + '...';
  });

  // Add a filter to extract guidance text between headings in markdown
  eleventyConfig.addFilter("extractGuidanceText", function(content) {
    if (!content) return "";

    // Work with raw markdown content
    const lines = content.split('\n');
    let isInGuidanceSection = false;
    let guidanceLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if we're entering the "Guidance Needed" section
      if (line.match(/^#+\s*Guidance Needed/i)) {
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
      const markdownIt = require("markdown-it")();
      const htmlContent = markdownIt.render(rawText);
      return htmlContent.replace(/<[^>]*>/g, "").trim();
    }

    return rawText;
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};
