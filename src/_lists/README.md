# Curated FAQ Lists

This directory contains YAML files that define curated lists of FAQs. Each YAML file represents a curated collection that will be automatically processed and made available at `/lists/`.

## File Structure

Each YAML file should follow this structure:

```yaml
title: "Display Name for the List"
description: "Brief description of what this list covers"
order: 1  # Optional: controls display order (lower numbers first)
faqs:
  - category: "category-name"
    filename: "filename.md"
  - category: "another-category"
    filename: "another-file.md"
```

## Quality Control

The system automatically:
- Only includes FAQs that have complete questions and answers
- Excludes draft items
- Filters out items with missing content
- Shows count of available complete FAQs

## Adding a New List

1. Create a new `.yaml` file in this directory
2. Use a descriptive filename (becomes the URL slug)
3. Define the title, description, and FAQ references
4. The list will automatically appear at `/lists/filename/`

## URL Structure

- List index: `/lists/`
- Individual lists: `/lists/{filename}/`

## Example

For a file named `beginners.yaml`:
- URL: `/lists/beginners/`
- Content: FAQs suitable for beginners

## Notes

- Files are processed in alphabetical order unless `order` field is specified
- Invalid YAML files will be skipped with a warning
- FAQ references that don't exist or are incomplete will be filtered out
- Changes to YAML files require a site rebuild to take effect