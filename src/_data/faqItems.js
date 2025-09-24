// Lightweight adapter for flat FAQ data (used for pagination)
module.exports = function () {
  return require('./allContent.js')().faqItems;
};