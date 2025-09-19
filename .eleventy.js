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

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};
