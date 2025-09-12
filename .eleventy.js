module.exports = function(eleventyConfig) {
  // example passthrough or plugins
  eleventyConfig.addPassthroughCopy("styles");

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
