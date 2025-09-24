// Lightweight adapter for categorized FAQ data
module.exports = function () {
  return require('./allContent.js')().faqsByCategory;
};
