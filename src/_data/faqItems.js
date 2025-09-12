const faq = require('./faq.js');

module.exports = function () {
  const faqData = faq();
  const items = [];

  // Flatten the FAQ structure for pagination
  for (const [category, questions] of Object.entries(faqData)) {
    for (const question of questions) {
      items.push({
        ...question,
        category
      });
    }
  }

  return items;
};