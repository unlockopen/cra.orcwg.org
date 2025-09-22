const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const faq = require('./faq.js');

const LISTS_DIR = path.join(__dirname, "..", "_lists");

function loadCuratedListsFromYAML() {
  const listsConfig = {};

  if (!fs.existsSync(LISTS_DIR)) {
    return listsConfig;
  }

  const files = fs.readdirSync(LISTS_DIR);
  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const filePath = path.join(LISTS_DIR, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const listKey = file.replace(/\.(yaml|yml)$/, '');

      try {
        const listConfig = yaml.load(fileContent);
        listsConfig[listKey] = listConfig;
      } catch (error) {
        console.warn(`Error parsing YAML file ${file}:`, error.message);
      }
    }
  }

  return listsConfig;
}

function isCompleteItem(item) {
  // Only include FAQs that have both question and answer
  return item.question &&
    item.answer &&
    item.answer.trim().length > 0;
}

module.exports = function () {
  const faqData = faq();
  const curatedListsConfig = loadCuratedListsFromYAML();
  const result = [];

  // Sort lists by order field if present
  const sortedLists = Object.entries(curatedListsConfig).sort(([, a], [, b]) => {
    return (a.order || 999) - (b.order || 999);
  });

  for (const [listKey, listConfig] of sortedLists) {
    const listItems = [];

    for (const faqRef of listConfig.faqs) {
      // Find the FAQ item in the data
      const categoryItems = faqData[faqRef.category];
      if (categoryItems) {
        const faqItem = categoryItems.find(item => item.filename === faqRef.filename);
        if (faqItem && isCompleteItem(faqItem)) {
          listItems.push({
            ...faqItem,
            category: faqRef.category,
            url: `/faq/${faqRef.category}/${faqRef.filename.replace('.md', '')}/`
          });
        }
      }
    }

    result.push({
      key: listKey,
      value: {
        ...listConfig,
        items: listItems,
        count: listItems.length
      }
    });
  }

  return result;
};
