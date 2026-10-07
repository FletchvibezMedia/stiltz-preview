# Stiltz of Florida production deployment

This repository deploys the finalized Stiltz of Florida Version 15 release to GitHub Pages.

The deployment workflow pulls the published rescue release, preserves its media and working interactions, and prepares a production-only export with:

- canonical URLs at `https://stiltzofflorida.com`
- `index, follow` robots directives
- `robots.txt` and `sitemap.xml`
- the GitHub Pages custom-domain file

The ChatGPT rescue site remains separate and intentionally no-indexed as a fallback.
