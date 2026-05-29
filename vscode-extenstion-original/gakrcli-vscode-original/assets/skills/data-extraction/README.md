# Data Extraction Skills

This directory contains comprehensive, field-tested guides for extracting data from 47+ platforms and websites. Each guide includes working code examples, performance metrics (100ms-8s), confirmed selectors with test dates, rate limit information, and documented gotchas.

## What This Skill Provides

- **47+ Platform Guides**: Detailed extraction methods for e-commerce, social media, developer platforms, entertainment, academic sources, and public APIs
- **3 Extraction Methods**: HTTP GET (fastest, 100-400ms), Browser automation (2-8s), and Hybrid approaches
- **17 Browser Automation Techniques**: Scrolling, iframes, cookies, downloads, dialogs, shadow DOM, and more
- **Performance Metrics**: Actual latency measurements and optimization tips
- **Field-Tested Selectors**: Confirmed working selectors with test dates (e.g., "tested 2026-04-18")
- **Rate Limit Documentation**: Quota information for each platform
- **Gotchas & Solutions**: Common mistakes and how to avoid them

## When to Use This Skill

Use this skill when you need to:
- Extract product data, prices, reviews from e-commerce sites
- Gather social media posts, comments, user profiles
- Access developer platform data (repos, questions, code)
- Retrieve entertainment content (music, movies, games)
- Download academic papers and research data
- Fetch real-time data from public APIs (weather, crypto, economic)
- Automate browser interactions for data collection
- Handle dynamic content, infinite scroll, or JavaScript-rendered pages

## Directory Structure

### 📁 ecommerce-shopping/
E-commerce and shopping platforms
- **amazon/** - Product search, pricing, reviews, Best Sellers
- **ebay/** - Auction and product data
- **etsy/** - Handmade and vintage items
- **booking-com/** - Hotel and travel data

### 📁 social-media-content/
Social media and content platforms
- **reddit/** - Posts, comments using web components (shreddit-*)
- **facebook/** - Social data extraction
- **medium/** - Articles and publications
- **quora/** - Q&A content

### 📁 developer-platforms/
Developer and tech community platforms
- **github/** - Repos, stars, trending (REST API + browser)
- **stackoverflow/** - Questions, answers via Stack Exchange API
- **hackernews/** - Stories, comments (3 methods: HTML, Algolia, Firebase)
- **dev-to/** - Developer articles

### 📁 entertainment-media/
Entertainment, music, books, and gaming
- **spotify/** - Tracks, albums, playlists (oEmbed, HTML, embed pages)
- **letterboxd/** - Movie reviews and lists
- **goodreads/** - Book data and reviews
- **steam/** - Game information
- **itch-io/** - Indie games
- **genius/** - Song lyrics

### 📁 academic-research/
Academic papers, research, and libraries
- **arxiv/** - Research papers (single downloads)
- **arxiv-bulk/** - Bulk paper downloads
- **pubmed/** - Medical research papers
- **crossref/** - Academic citations
- **gutenberg/** - Public domain books
- **open-library/** - Library catalog data

### 📁 data-apis/
Data sources and public APIs
- **weather/** - Weather data (wttr.in, Open-Meteo, NWS)
- **rest-countries/** - Country information
- **fred/** - Economic data (Federal Reserve)
- **nasa/** - Space and astronomy data
- **coingecko/** - Cryptocurrency data
- **coinmarketcap/** - Cryptocurrency market data
- **musicbrainz/** - Music metadata
- **openstreetmap/** - Geographic data

### 📁 business-productivity/
Business, productivity, and learning platforms
- **producthunt/** - Product launches and discovery
- **eventbrite/** - Events and tickets
- **coursera/** - Online courses and education
- **capterra/** - Software reviews and comparisons
- **g2/** - Software reviews and ratings

### 📁 finance-markets/
Financial data and market analysis
- **tradingview/** - Financial charts and trading data
- **macrotrends/** - Market trends and historical data

### 📁 archives-tools/
Archives, tools, and miscellaneous platforms
- **archive-org/** - Internet Archive (Wayback Machine)
- **atlas/** - Data visualization tools
- **framer/** - Design and prototyping tools
- **thetechgeeks/** - Tech content and articles
- **craigslist/** - Classifieds and local listings

### 📁 aggregators/
Multi-source aggregation platforms
- **news-aggregation/** - Multi-source news
- **package-registries/** - npm, PyPI package data
- **duckduckgo/** - Search results

### 📁 interaction-skills/
Browser automation techniques (17 guides)
- **connection.md** - Tab management, daemon control
- **cookies.md** - Cookie handling
- **scrolling.md** - Page and container scrolling
- **iframes.md** - Working with iframes
- **cross-origin-iframes.md** - Cross-origin iframe handling
- **network-requests.md** - Monitoring network activity
- **downloads.md** - File downloads
- **uploads.md** - File uploads
- **dialogs.md** - Alert/confirm/prompt handling
- **dropdowns.md** - Select element interaction
- **drag-and-drop.md** - Drag and drop operations
- **tabs.md** - Multi-tab management
- **screenshots.md** - Capturing screenshots
- **print-as-pdf.md** - PDF generation
- **viewport.md** - Viewport manipulation
- **shadow-dom.md** - Shadow DOM traversal
- **profile-sync.md** - Browser profile management

## Guide Structure

Each platform guide typically includes:

1. **"Do this first"** - Quick decision table for choosing the right approach
2. **API vs Browser** - When to use REST APIs vs browser automation
3. **Code Examples** - Complete, runnable Python snippets
4. **Selectors** - CSS/DOM selectors with test dates
5. **Rate Limits** - Quota information and throttling details
6. **Gotchas** - Common mistakes and how to avoid them
7. **URL Patterns** - How to construct valid URLs
8. **Field Mappings** - Available data and locations

## Extraction Methods

### 1. HTTP GET (Fastest)
Plain HTTP requests for APIs or static HTML
- Example: Stack Overflow API, Weather APIs, Spotify oEmbed
- Latency: ~100-400ms

### 2. Browser Automation
When JavaScript rendering is required
- Example: Amazon search results, Reddit web components, GitHub trending
- Latency: 2-8 seconds

### 3. Hybrid Approach
API for metadata, browser for interactive features
- Example: GitHub (API for repos, browser for trending page)

## Key Features

- ✅ **Field-tested** - Includes actual test dates and confirmed working selectors
- ✅ **Performance-focused** - Latency measurements and optimization tips
- ✅ **Comprehensive** - Covers authentication, pagination, bulk fetching, error handling
- ✅ **Real-world tested** - Known limitations and edge cases documented
- ✅ **Code-ready** - Copy-paste working examples

## Usage

Each guide is self-contained and can be used independently. Choose the platform you need, follow the "Do this first" section, and use the provided code examples.

For browser automation tasks, refer to the `interaction-skills/` guides for specific techniques like scrolling, iframe handling, or cookie management.
