# cra.orcwg.org

Eleventy-based static site generator that creates a FAQ website for ORC WG's CRA Hub. The site consumes FAQ content from an external GitHub repository and generates a categorized FAQ website.

## Development Setup

### Prerequisites
- Node.js
- npm

### Installation
```bash
git clone https://github.com/ninnlangel/cra.orcwg.org.git
cd cra.orcwg.org
npm install
```

### Build Commands

- **`npm run serve`** - Start development server with live reload and cache update
- **`npm run watch`** - Watch for file changes and rebuild (no cache update)
- **`npm run build`** - Build the production site with cache update
- **`npm run update-cache`** - Manually update external content cache

## Architecture Overview

This is an Eleventy site that acts as a content processor and renderer for external FAQ content rather than managing content locally.

### Content Flow
1. **External Content** - FAQ content is maintained in the [`orcwg/cra-faq`](https://github.com/orcwg/cra-faq) repository
2. **Cache Update** - The `update-cache.sh` script clones/updates external content into `_cache/`
3. **Data Processing** - Eleventy data files (`src/_data/*.js`) parse cached markdown files into structured data
4. **Template Rendering** - Nunjucks templates render structured data into HTML pages
5. **Site Generation** - Final site is output to `_site/` for deployment

### FAQ Processing
- FAQ content comes from markdown files in the external `orcwg/cra-hub` repository
- Content is organized by directory structure and processed by `src/_data/faq.js`
- Questions are extracted from markdown `#` headings
- Answers are content following the first heading
- Status tracking: `draft`, `approved`, `pending-guidance`

### Curated Lists
- YAML files in `src/_lists/` define curated FAQ collections
- Each YAML file creates a new list page at `/lists/{filename}/`
- Lists reference specific FAQs by category and filename
- Automatic quality control filters incomplete/draft content

### Site Configuration
- Global site settings in `src/_data/site.json`
- Footer content and navigation configured via JSON data

## External Dependencies

### Primary Content Source
- **Repository**: [`orcwg/cra-faq`](https://github.com/orcwg/cra-faq)
- **Purpose**: Contains all FAQ content in markdown format
- **Update**: Automatically pulled during builds via `update-cache.sh`

### Technology Stack
- **Static Site Generator**: Eleventy 3.x
- **Template Engine**: Nunjucks
- **Markdown Processing**: markdown-it
- **Diagram Support**: Mermaid.js

## Deployment

The site is designed to be deployed as a static site. The build process:

1. Updates external content cache
2. Processes FAQ data from cached repository
3. Generates static HTML pages
4. Outputs complete site to `_site/` directory

## License

This project is licensed under the terms of the Apache License Version 2.0.

SPDX-License-Identifier: Apache-2.0

