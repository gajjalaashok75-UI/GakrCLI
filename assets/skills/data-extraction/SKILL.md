---
name: data-extraction
description: Extract data from 47+ websites and platforms using field-tested guides with working code examples, confirmed selectors, and performance metrics. Use when you need to scrape product data (Amazon, eBay), social media content (Reddit, Facebook), developer platforms (GitHub, Stack Overflow), entertainment (Spotify, Steam), academic papers (arXiv, PubMed), or access public APIs (weather, crypto, economic data). Includes 17 browser automation techniques for handling scrolling, iframes, cookies, and dynamic content. Each guide provides HTTP GET vs browser decision trees, rate limits, gotchas, and tested extraction patterns.
---

# Data Extraction

Extract data from websites and platforms using proven methods, tested selectors, and optimized approaches.

## Overview

This skill provides comprehensive, field-tested guides for extracting data from 47+ platforms and websites. Each guide includes working code examples, performance metrics, and battle-tested selectors with known gotchas.

## When to Use This Skill

Use this skill when you need to:
- Extract data from popular websites and platforms
- Scrape product information, prices, reviews
- Gather social media content, posts, comments
- Access developer platform data (GitHub, Stack Overflow, etc.)
- Retrieve academic papers and research data
- Fetch real-time data from APIs (weather, crypto, economic data)
- Automate browser interactions for data collection

## How to Use This Skill

### Step 1: Identify Your Platform

Find your target platform in one of these categories:

**E-commerce & Shopping** → `ecommerce-shopping/`
- Amazon, eBay, Etsy, Booking.com

**Social Media & Content** → `social-media-content/`
- Reddit, Facebook, Medium, Quora

**Developer Platforms** → `developer-platforms/`
- GitHub, Stack Overflow, Hacker News, Dev.to

**Entertainment & Media** → `entertainment-media/`
- Spotify, Letterboxd, Goodreads, Steam, Itch.io, Genius

**Academic & Research** → `academic-research/`
- arXiv, PubMed, Crossref, Gutenberg, Open Library

**Data & APIs** → `data-apis/`
- Weather, REST Countries, FRED, NASA, CoinGecko, CoinMarketCap, MusicBrainz, OpenStreetMap

**Business & Productivity** → `business-productivity/`
- ProductHunt, Eventbrite, Coursera, Capterra, G2

**Finance & Markets** → `finance-markets/`
- TradingView, MacroTrends

**Archives & Tools** → `archives-tools/`
- Archive.org, Atlas, Framer, TheTechGeeks, Craigslist

**Aggregators** → `aggregators/`
- News Aggregation, Package Registries (npm/PyPI), DuckDuckGo

### Step 2: Choose Your Extraction Method

Each platform guide starts with a **"Do this first"** section that helps you choose:

#### Method 1: HTTP GET (Fastest - Preferred)
**When to use:**
- Platform has a public API
- Data is in static HTML
- No JavaScript rendering needed
- Need maximum speed (100-400ms)

**Example platforms:**
- Stack Overflow API
- Weather APIs (wttr.in, Open-Meteo)
- Spotify oEmbed
- Hacker News (HTML/Algolia/Firebase)
- GitHub REST API

**Code pattern:**
```python
import json
from helpers import http_get

data = json.loads(http_get("https://api.example.com/endpoint"))
# Process data directly
```

#### Method 2: Browser Automation (When JS Required)
**When to use:**
- Content loads dynamically with JavaScript
- Need to interact with page elements
- Login/authentication required
- Content behind user interactions

**Example platforms:**
- Amazon search results
- Reddit web components
- GitHub trending page
- Social media feeds

**Code pattern:**
```python
new_tab("https://example.com")
wait_for_load()
wait(2)  # Extra time for JS hydration
data = js("document.querySelector('.selector').innerText")
```

#### Method 3: Hybrid Approach
**When to use:**
- API available for some data
- Browser needed for specific features
- Want to optimize performance

**Example platforms:**
- GitHub (API for repos, browser for trending)
- Spotify (oEmbed for metadata, embed page for track lists)

### Step 3: Read the Platform Guide

Each guide contains:

1. **"Do this first"** - Decision table for choosing approach
2. **Navigation patterns** - URLs and routing
3. **Code examples** - Copy-paste ready snippets
4. **Selectors** - Confirmed working CSS/DOM selectors with test dates
5. **Field mappings** - What data is available and where
6. **Rate limits** - Quota information
7. **Gotchas** - Common mistakes and edge cases

### Step 4: Use Interaction Skills (If Needed)

For browser automation, refer to `interaction-skills/` for specific techniques:

**Connection & Setup:**
- `connection.md` - Tab management, daemon control, bringing Chrome to front

**Page Interaction:**
- `scrolling.md` - Page scroll, nested containers, virtualized lists
- `clicks.md` - Click handling, coordinates
- `dropdowns.md` - Select elements, custom dropdowns

**Content Extraction:**
- `iframes.md` - Same-origin iframe traversal
- `cross-origin-iframes.md` - Cross-origin handling
- `shadow-dom.md` - Shadow DOM traversal

**Data Management:**
- `cookies.md` - Get, save, set cookies
- `network-requests.md` - Monitor network activity
- `downloads.md` - Handle file downloads
- `uploads.md` - File upload handling

**Advanced:**
- `dialogs.md` - Alert/confirm/prompt handling
- `drag-and-drop.md` - Drag and drop operations
- `tabs.md` - Multi-tab management
- `screenshots.md` - Capture screenshots
- `print-as-pdf.md` - PDF generation
- `viewport.md` - Viewport manipulation
- `profile-sync.md` - Browser profile management

## Quick Start Examples

### Example 1: Get Weather Data (API - Fastest)
```python
import json
from helpers import http_get

# One-call current + 3-day forecast
data = json.loads(http_get("https://wttr.in/San+Francisco?format=j1"))
current = data['current_condition'][0]
print(f"{current['temp_F']}°F, {current['weatherDesc'][0]['value']}")
```

### Example 2: GitHub Trending (Browser Required)
```python
import json

goto("https://github.com/trending")
wait_for_load()
wait(2)

repos = js("""
  Array.from(document.querySelectorAll('article.Box-row')).map(el => ({
    name: el.querySelector('h2 a')?.innerText.trim(),
    stars: el.querySelector('a[href*="/stargazers"]')?.innerText.trim(),
    language: el.querySelector('[itemprop="programmingLanguage"]')?.innerText
  }))
""")
```

### Example 3: Stack Overflow Questions (API)
```python
import json
from helpers import http_get

data = json.loads(http_get(
    "https://api.stackexchange.com/2.3/questions"
    "?order=desc&sort=votes&tagged=python&site=stackoverflow"
    "&pagesize=5&filter=withbody"
))

for q in data['items']:
    print(f"{q['score']} - {q['title']}")
```

### Example 4: Amazon Product Search (Browser)
```python
goto("https://www.amazon.com/s?k=mechanical+keyboard")
wait_for_load()
wait(2)

results = js("""
  Array.from(document.querySelectorAll('[data-component-type="s-search-result"]'))
    .map(el => ({
      title: el.querySelector('h2 span')?.innerText,
      price: el.querySelector('.a-price .a-offscreen')?.innerText,
      rating: el.querySelector('[aria-label*="out of 5 stars"]')?.getAttribute('aria-label')
    }))
""")
```

### Example 5: Spotify Track Info (HTTP - No Auth)
```python
import json
from helpers import http_get

# oEmbed API - fastest
track_id = "4PTG3Z6ehGkBFwjybzWkR8"
url = f"https://open.spotify.com/oembed?url=https://open.spotify.com/track/{track_id}"
data = json.loads(http_get(url))
print(f"{data['title']} - {data['thumbnail_url']}")
```

## Performance Guidelines

### Speed Comparison
- **HTTP GET API**: 100-400ms ⚡ (Fastest)
- **HTTP GET HTML**: 170-800ms ⚡ (Fast)
- **Browser automation**: 2-8 seconds 🐢 (Slow)

### Best Practices

1. **Always prefer HTTP GET over browser**
   - 20-50x faster
   - No browser overhead
   - More reliable

2. **Check for APIs first**
   - Many platforms have public APIs
   - Often better structured than HTML
   - Example: Stack Overflow, GitHub, Spotify

3. **Use browser only when necessary**
   - JavaScript-rendered content
   - Login required
   - Interactive elements needed

4. **Parallel fetching for bulk data**
   ```python
   from concurrent.futures import ThreadPoolExecutor
   
   with ThreadPoolExecutor(max_workers=5) as ex:
       results = list(ex.map(fetch_function, item_list))
   ```

5. **Respect rate limits**
   - Check API documentation
   - Monitor quota in responses
   - Add delays between requests if needed

6. **Cache when possible**
   - Store frequently accessed data
   - Reduce API calls
   - Improve performance

## Common Patterns

### Pattern 1: API with Pagination
```python
import json
from helpers import http_get

def fetch_all_pages(base_url, max_pages=5):
    results = []
    for page in range(1, max_pages + 1):
        data = json.loads(http_get(f"{base_url}&page={page}"))
        results.extend(data['items'])
        if not data.get('has_more'):
            break
    return results
```

### Pattern 2: Browser with Scroll Loading
```python
goto("https://example.com/feed")
wait_for_load()
wait(2)

# Scroll to load more content
for i in range(3):
    scroll(500, 500, dy=2000)
    wait(1)

# Extract all loaded items
items = js("Array.from(document.querySelectorAll('.item')).map(el => el.innerText)")
```

### Pattern 3: Hybrid (API + Browser)
```python
import json
from helpers import http_get

# Step 1: Get metadata from API (fast)
data = json.loads(http_get("https://api.example.com/item/123"))

# Step 2: Use browser only for JS-rendered content
if data['requires_browser']:
    goto(data['url'])
    wait_for_load()
    extra_data = js("document.querySelector('.dynamic-content').innerText")
```

### Pattern 4: Error Handling
```python
import json
from helpers import http_get

try:
    data = json.loads(http_get("https://api.example.com/endpoint"))
    if data.get('error'):
        print(f"API Error: {data['error']}")
    else:
        # Process data
        pass
except Exception as e:
    print(f"Request failed: {e}")
    # Fallback or retry logic
```

## Troubleshooting

### Issue: Rate Limited
**Solution:**
- Check platform guide for rate limits
- Add delays between requests
- Use API key if available
- Consider caching results

### Issue: Selector Not Working
**Solution:**
- Check platform guide for updated selectors
- Verify page loaded completely (`wait_for_load()` + `wait(2)`)
- Inspect page structure (may have changed)
- Try alternative selectors from guide

### Issue: Empty Results
**Solution:**
- Add extra wait time after `wait_for_load()`
- Check if content is in iframe
- Verify selector matches current page structure
- Check if login/authentication required

### Issue: CAPTCHA or Bot Detection
**Solution:**
- Use logged-in browser session
- Add realistic delays between actions
- Avoid rapid-fire requests
- Consider using official API instead

### Issue: Data Format Changed
**Solution:**
- Check guide's "Gotchas" section
- Verify test date in guide
- Inspect current page structure
- Update selectors as needed

## Platform-Specific Notes

### Amazon
- Always use `new_tab()` on first visit
- Wait 2s after `wait_for_load()` for dynamic content
- Use `data-asin` attribute for product IDs
- First 2-3 results are usually paid placements

### GitHub
- Use REST API for repo data (60 req/hour unauthenticated)
- Use browser only for trending page
- Token increases limit to 5,000/hour
- Search API: 10 req/min separate limit

### Stack Overflow
- 300 req/day unauthenticated
- Always use `filter=withbody` for content
- Titles have HTML entities - use `html.unescape()`
- Check `quota_remaining` in responses

### Reddit
- Use `shreddit-post` and `shreddit-comment` selectors
- Scroll twice to load more comments
- `faceplate-number` attribute for exact counts
- Share URLs redirect to canonical

### Spotify
- oEmbed API: no auth, ~250ms
- Embed page `__NEXT_DATA__` for track lists
- Anonymous tokens are rate-limited
- Use HTTP GET, not browser

### Weather
- wttr.in: fastest, requires `?format=j1`
- Open-Meteo: most complete, free 10K/day
- weather.gov: US only, official NWS data
- Never use browser for weather APIs

## Advanced Techniques

### Bulk Data Collection
```python
from concurrent.futures import ThreadPoolExecutor
import json
from helpers import http_get

def fetch_item(item_id):
    try:
        return json.loads(http_get(f"https://api.example.com/items/{item_id}"))
    except:
        return None

item_ids = range(1, 101)  # 100 items
with ThreadPoolExecutor(max_workers=10) as ex:
    results = list(ex.map(fetch_item, item_ids))
    
valid_results = [r for r in results if r is not None]
```

### Dynamic Content Waiting
```python
goto("https://example.com")
wait_for_load()

# Wait for specific element to appear
max_attempts = 10
for i in range(max_attempts):
    element = js("document.querySelector('.target-element')")
    if element:
        break
    wait(0.5)
```

### Cookie-Based Authentication
```python
# Load cookies from file
import json
cookies = json.load(open('cookies.json'))

# Set cookies before navigation
for cookie in cookies:
    js(f"document.cookie = '{cookie['name']}={cookie['value']}'")

goto("https://example.com/protected")
wait_for_load()
```

## Summary

This skill provides:
- ✅ 47+ platform-specific extraction guides
- ✅ 17 browser automation technique guides
- ✅ Field-tested code examples with dates
- ✅ Performance metrics and optimization tips
- ✅ Rate limits and quota information
- ✅ Common gotchas and solutions

**Remember:**
1. Check platform guide's "Do this first" section
2. Prefer HTTP GET over browser (20-50x faster)
3. Use interaction-skills for browser techniques
4. Respect rate limits and add delays
5. Handle errors gracefully with try/except

For detailed implementation, navigate to the specific platform guide in the appropriate category folder.
and also check the reference/ for the test files ok 
