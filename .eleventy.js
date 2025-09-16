module.exports = function(eleventyConfig) {
  // Copy CSS files to output
  eleventyConfig.addPassthroughCopy("src/css");

  // Add markdown filter
  eleventyConfig.addFilter("markdown", function(content) {
    const markdownIt = require("markdown-it")();
    return markdownIt.render(content || "");
  });

  return {
    dir: {
      input: "src",
      output: "_site"
    }
  };
};
