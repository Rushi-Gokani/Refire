# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Shopify theme called "Savor" (version 2.1.6), a production-ready e-commerce theme designed for food and restaurant businesses. It follows Shopify 2.0 architecture with JSON templates and section-based design.

## Key Architecture

### Directory Structure
- `/config/` - Theme configuration (settings_schema.json defines customization options, settings_data.json stores values)
- `/layout/` - Base HTML templates (theme.liquid is the main wrapper)
- `/templates/` - Page templates using JSON format for flexible section arrangement
- `/sections/` - Reusable page sections (header, footer, hero, product sections)
- `/blocks/` - Smaller component blocks used within sections
- `/snippets/` - Reusable Liquid code fragments and utilities
- `/assets/` - CSS, JavaScript, and image files
- `/locales/` - Internationalization files supporting 25+ languages

### Technology Stack
- **Liquid** - Shopify's templating language for all `.liquid` files
- **JSON** - Configuration and template structure
- **JavaScript** - Component behavior (65 files in assets/)
- **CSS** - Styling (base.css, overflow-list.css, template-giftcard.css)

## Development Commands

### Shopify CLI Commands
```bash
# Login to Shopify
shopify login --store your-store.myshopify.com

# Serve theme locally with hot reload
shopify theme dev

# Push theme to store
shopify theme push

# Pull latest theme from store
shopify theme pull

# Check theme for errors
shopify theme check
```

### Common Development Tasks
```bash
# Open theme preview
shopify theme open

# List themes on store
shopify theme list

# Create new theme on store
shopify theme push --unpublished
```

## Important Conventions

### Liquid Component Documentation
Components in `/snippets/` like `button.liquid` include JSDoc-style documentation. When modifying these, maintain the documentation format:
```liquid
{% comment %}
  @param {String} param_name - Description
{% endcomment %}
```

### Template Structure
JSON templates in `/templates/` define section order and settings. Example structure:
```json
{
  "sections": {
    "section-id": {
      "type": "section-name",
      "settings": {}
    }
  },
  "order": ["section-id"]
}
```

### Internationalization
All user-facing text should use translation keys from `/locales/en.default.json`:
```liquid
{{ 'general.search.search' | t }}
```

### Asset References
Use Shopify's asset filters for CSS/JS files:
```liquid
{{ 'base.css' | asset_url | stylesheet_tag }}
{{ 'cart.js' | asset_url | script_tag }}
```

## Component Architecture

### Section-Block Relationship
- Sections contain blocks and can be dynamically added to pages
- Blocks are smaller components that can be added/removed within sections
- Snippets are included via `{% render 'snippet-name' %}` and accept parameters

### Key Component Files
- `snippets/button.liquid` - Reusable button component with extensive parameters
- `snippets/product-card.liquid` - Product display component
- `sections/header.liquid` - Site header with navigation
- `sections/footer.liquid` - Site footer with links and information

## Testing Approach

Shopify themes don't have traditional unit tests. Testing involves:
1. Using `shopify theme check` for linting and best practices
2. Preview changes with `shopify theme dev`
3. Test across different devices using Shopify's responsive preview
4. Verify translations by switching store language

## Working with Theme Settings

Theme customization options are defined in `config/settings_schema.json`. When adding new settings:
1. Define the setting in settings_schema.json
2. Access in Liquid via `{{ settings.setting_name }}`
3. Default values are stored in settings_data.json