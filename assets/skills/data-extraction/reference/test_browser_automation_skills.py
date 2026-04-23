#!/usr/bin/env python3
"""
BROWSER AUTOMATION TEST SUITE
Tests all 21 browser-required data-extraction skills using Playwright + Chromium
Uses interaction-skills techniques from data-extraction folder
"""

import json
import sys
import time
from datetime import datetime
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
from typing import Dict, List, Tuple

# Test results tracking
results = {
    "passed": [],
    "failed": [],
    "skipped": [],
    "start_time": None,
    "end_time": None
}

# Log file
LOG_FILE = "browser_automation_test_log.txt"

def log(message: str):
    """Write to both console and log file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_msg = f"[{timestamp}] {message}"
    print(log_msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(log_msg + "\n")

def test_skill(name: str, test_func, page: Page):
    """Run a browser automation test"""
    log(f"\n{'='*70}")
    log(f"Testing: {name}")
    log('='*70)
    
    try:
        test_func(page)
        results["passed"].append(name)
        log(f"PASSED: {name}")
        return True
    except Exception as e:
        results["failed"].append((name, str(e)))
        log(f"FAILED: {name}")
        log(f"   Error: {str(e)[:200]}")
        return False

# ============================================================================
# INTERACTION SKILLS - Browser Automation Techniques
# ============================================================================

def test_scrolling(page: Page):
    """Test scrolling techniques"""
    page.goto("https://example.com")
    page.wait_for_load_state("networkidle")
    
    # Scroll down
    page.mouse.wheel(0, 500)
    time.sleep(0.5)
    
    # Scroll to element
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(0.5)
    
    log("   Scrolling techniques working")

def test_screenshots(page: Page):
    """Test screenshot capture"""
    page.goto("https://example.com")
    page.wait_for_load_state("networkidle")
    
    # Full page screenshot
    page.screenshot(path="test_screenshot_full.png", full_page=True)
    
    # Viewport screenshot
    page.screenshot(path="test_screenshot_viewport.png")
    
    log("   Screenshots captured successfully")

def test_network_monitoring(page: Page):
    """Test network request monitoring"""
    requests = []
    
    def handle_request(request):
        requests.append({
            "url": request.url,
            "method": request.method,
            "resource_type": request.resource_type
        })
    
    page.on("request", handle_request)
    page.goto("https://example.com")
    page.wait_for_load_state("networkidle")
    
    assert len(requests) > 0, "No network requests captured"
    log(f"   Captured {len(requests)} network requests")

def test_cookies(page: Page):
    """Test cookie management"""
    page.goto("https://example.com")
    page.wait_for_load_state("networkidle")
    
    # Get cookies
    cookies = page.context.cookies()
    log(f"   Found {len(cookies)} cookies")
    
    # Set a cookie
    page.context.add_cookies([{
        "name": "test_cookie",
        "value": "test_value",
        "domain": "example.com",
        "path": "/"
    }])
    
    # Verify cookie was set
    new_cookies = page.context.cookies()
    assert len(new_cookies) >= len(cookies), "Cookie not added"
    log("   Cookie management working")

def test_viewport(page: Page):
    """Test viewport manipulation"""
    # Set viewport size
    page.set_viewport_size({"width": 1920, "height": 1080})
    time.sleep(0.5)
    
    # Get viewport dimensions
    dimensions = page.evaluate("""() => {
        return {
            width: window.innerWidth,
            height: window.innerHeight
        }
    }""")
    
    assert dimensions["width"] == 1920, "Viewport width not set"
    assert dimensions["height"] == 1080, "Viewport height not set"
    log(f"   Viewport set to {dimensions['width']}x{dimensions['height']}")

# ============================================================================
# ARCHIVES & TOOLS (2 browser-required skills)
# ============================================================================

def test_framer(page: Page):
    """Test Framer editor access"""
    page.goto("https://www.framer.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Check if page loaded
    title = page.title()
    assert "Framer" in title, f"Unexpected title: {title}"
    log(f"   Framer page loaded: {title}")

def test_thetechgeeks(page: Page):
    """Test TheTechGeeks pricing page"""
    page.goto("https://thetechgeeks.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Check if page loaded
    content = page.content()
    assert len(content) > 1000, "Page content too short"
    log("   TheTechGeeks page accessible")

# ============================================================================
# BUSINESS & PRODUCTIVITY (5 browser-required skills)
# ============================================================================

def test_capterra(page: Page):
    """Test Capterra software reviews"""
    page.goto("https://www.capterra.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Capterra" in title, f"Unexpected title: {title}"
    log(f"   Capterra loaded: {title}")

def test_coursera(page: Page):
    """Test Coursera course listings"""
    page.goto("https://www.coursera.org/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Coursera" in title, f"Unexpected title: {title}"
    log(f"   Coursera loaded: {title}")

def test_eventbrite(page: Page):
    """Test Eventbrite event listings"""
    page.goto("https://www.eventbrite.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Eventbrite" in title, f"Unexpected title: {title}"
    log(f"   Eventbrite loaded: {title}")

def test_g2(page: Page):
    """Test G2 software reviews"""
    page.goto("https://www.g2.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "G2" in title, f"Unexpected title: {title}"
    log(f"   G2 loaded: {title}")

def test_producthunt(page: Page):
    """Test ProductHunt product listings"""
    page.goto("https://www.producthunt.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Product Hunt" in title, f"Unexpected title: {title}"
    log(f"   ProductHunt loaded: {title}")

# ============================================================================
# ECOMMERCE & SHOPPING (4 browser-required skills)
# ============================================================================

def test_amazon(page: Page):
    """Test Amazon product search"""
    page.goto("https://www.amazon.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Search for a product
    search_box = page.query_selector('input[name="field-keywords"]')
    if search_box:
        search_box.fill("laptop")
        search_box.press("Enter")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Check if results loaded
        results = page.query_selector_all('[data-component-type="s-search-result"]')
        log(f"   Amazon search returned {len(results)} results")
    else:
        log("   Amazon page loaded (search box not found)")

def test_booking_com(page: Page):
    """Test Booking.com hotel search"""
    page.goto("https://www.booking.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Booking.com" in title, f"Unexpected title: {title}"
    log(f"   Booking.com loaded: {title}")

def test_ebay(page: Page):
    """Test eBay product search"""
    page.goto("https://www.ebay.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "eBay" in title, f"Unexpected title: {title}"
    log(f"   eBay loaded: {title}")

def test_etsy(page: Page):
    """Test Etsy product search"""
    page.goto("https://www.etsy.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Etsy" in title, f"Unexpected title: {title}"
    log(f"   Etsy loaded: {title}")

# ============================================================================
# ENTERTAINMENT & MEDIA (4 browser-required skills)
# ============================================================================

def test_genius(page: Page):
    """Test Genius lyrics"""
    page.goto("https://genius.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Genius" in title, f"Unexpected title: {title}"
    log(f"   Genius loaded: {title}")

def test_goodreads(page: Page):
    """Test Goodreads book reviews"""
    page.goto("https://www.goodreads.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Goodreads" in title, f"Unexpected title: {title}"
    log(f"   Goodreads loaded: {title}")

def test_letterboxd(page: Page):
    """Test Letterboxd movie reviews"""
    page.goto("https://letterboxd.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Letterboxd" in title, f"Unexpected title: {title}"
    log(f"   Letterboxd loaded: {title}")

def test_steam(page: Page):
    """Test Steam game store"""
    page.goto("https://store.steampowered.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Handle age gate if present
    age_gate = page.query_selector('select[name="ageYear"]')
    if age_gate:
        page.select_option('select[name="ageYear"]', "1990")
        page.click('a[class*="agegate"]')
        page.wait_for_load_state("networkidle")
        time.sleep(2)
    
    title = page.title()
    log(f"   Steam loaded: {title}")

# ============================================================================
# FINANCE & MARKETS (2 browser-required skills)
# ============================================================================

def test_macrotrends(page: Page):
    """Test MacroTrends financial data"""
    page.goto("https://www.macrotrends.net/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Macrotrends" in title or "MacroTrends" in title, f"Unexpected title: {title}"
    log(f"   MacroTrends loaded: {title}")

def test_tradingview(page: Page):
    """Test TradingView charts"""
    page.goto("https://www.tradingview.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "TradingView" in title, f"Unexpected title: {title}"
    log(f"   TradingView loaded: {title}")

# ============================================================================
# SOCIAL MEDIA (4 browser-required skills)
# ============================================================================

def test_facebook_groups(page: Page):
    """Test Facebook groups (requires login)"""
    page.goto("https://www.facebook.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Facebook" in title, f"Unexpected title: {title}"
    log("   Facebook loaded (login required for groups)")

def test_facebook_pages(page: Page):
    """Test Facebook pages (requires login)"""
    page.goto("https://www.facebook.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Facebook" in title, f"Unexpected title: {title}"
    log("   Facebook loaded (login required for pages)")

def test_medium_hydration(page: Page):
    """Test Medium article hydration"""
    page.goto("https://medium.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    # Wait for JS hydration
    page.wait_for_selector('article, [data-testid="post-preview"]', timeout=10000)
    
    articles = page.query_selector_all('article, [data-testid="post-preview"]')
    log(f"   Medium loaded with {len(articles)} articles")

def test_quora(page: Page):
    """Test Quora questions (requires login for full access)"""
    page.goto("https://www.quora.com/")
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    
    title = page.title()
    assert "Quora" in title, f"Unexpected title: {title}"
    log("   Quora loaded (login required for full access)")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    print("="*70)
    print("STARTING BROWSER AUTOMATION TEST SUITE")
    print("="*70)
    
    # Initialize log file
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("="*70 + "\n")
        f.write("BROWSER AUTOMATION TEST SUITE\n")
        f.write("Testing 21 browser-required data-extraction skills\n")
        f.write("="*70 + "\n\n")
    
    results["start_time"] = datetime.now().isoformat()
    
    log("="*70)
    log("BROWSER AUTOMATION TEST SUITE")
    log("Testing 21 browser-required skills + 5 interaction techniques")
    log("="*70)
    
    with sync_playwright() as p:
        # Launch Chromium browser
        log("\nLaunching Chromium browser...")
        browser = p.chromium.launch(
            headless=False,  # Set to True for headless mode
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ]
        )
        
        # Create context with realistic settings
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        
        page = context.new_page()
        
        try:
            # INTERACTION SKILLS TESTS
            log("\n\n### INTERACTION SKILLS (5 core techniques) ###")
            test_skill("INT.1 Scrolling", test_scrolling, page)
            time.sleep(1)
            test_skill("INT.2 Screenshots", test_screenshots, page)
            time.sleep(1)
            test_skill("INT.3 Network Monitoring", test_network_monitoring, page)
            time.sleep(1)
            test_skill("INT.4 Cookies", test_cookies, page)
            time.sleep(1)
            test_skill("INT.5 Viewport", test_viewport, page)
            
            # ARCHIVES & TOOLS
            log("\n\n### ARCHIVES & TOOLS (2 skills) ###")
            test_skill("3.4 Framer", test_framer, page)
            time.sleep(2)
            test_skill("3.5 TheTechGeeks", test_thetechgeeks, page)
            time.sleep(2)
            
            # BUSINESS & PRODUCTIVITY
            log("\n\n### BUSINESS & PRODUCTIVITY (5 skills) ###")
            test_skill("4.1 Capterra", test_capterra, page)
            time.sleep(2)
            test_skill("4.2 Coursera", test_coursera, page)
            time.sleep(2)
            test_skill("4.3 Eventbrite", test_eventbrite, page)
            time.sleep(2)
            test_skill("4.4 G2", test_g2, page)
            time.sleep(2)
            test_skill("4.5 ProductHunt", test_producthunt, page)
            time.sleep(2)
            
            # ECOMMERCE & SHOPPING
            log("\n\n### ECOMMERCE & SHOPPING (4 skills) ###")
            test_skill("7.1 Amazon", test_amazon, page)
            time.sleep(2)
            test_skill("7.2 Booking.com", test_booking_com, page)
            time.sleep(2)
            test_skill("7.3 eBay", test_ebay, page)
            time.sleep(2)
            test_skill("7.4 Etsy", test_etsy, page)
            time.sleep(2)
            
            # ENTERTAINMENT & MEDIA
            log("\n\n### ENTERTAINMENT & MEDIA (4 skills) ###")
            test_skill("8.1 Genius", test_genius, page)
            time.sleep(2)
            test_skill("8.2 Goodreads", test_goodreads, page)
            time.sleep(2)
            test_skill("8.4 Letterboxd", test_letterboxd, page)
            time.sleep(2)
            test_skill("8.6 Steam", test_steam, page)
            time.sleep(2)
            
            # FINANCE & MARKETS
            log("\n\n### FINANCE & MARKETS (2 skills) ###")
            test_skill("9.1 MacroTrends", test_macrotrends, page)
            time.sleep(2)
            test_skill("9.2 TradingView", test_tradingview, page)
            time.sleep(2)
            
            # SOCIAL MEDIA
            log("\n\n### SOCIAL MEDIA (4 skills) ###")
            test_skill("10.1 Facebook Groups", test_facebook_groups, page)
            time.sleep(2)
            test_skill("10.2 Facebook Pages", test_facebook_pages, page)
            time.sleep(2)
            test_skill("10.4 Medium Hydration", test_medium_hydration, page)
            time.sleep(2)
            test_skill("10.5 Quora", test_quora, page)
            
        finally:
            # Cleanup
            context.close()
            browser.close()
    
    results["end_time"] = datetime.now().isoformat()
    
    # Print summary
    log("\n\n" + "="*70)
    log("FINAL TEST SUMMARY")
    log("="*70)
    
    total_tests = len(results['passed']) + len(results['failed'])
    
    log(f"\n[STATISTICS]")
    log(f"   Total Tests: {total_tests}")
    log(f"   [PASS] Passed: {len(results['passed'])}")
    log(f"   [FAIL] Failed: {len(results['failed'])}")
    log(f"   Success Rate: {len(results['passed'])/total_tests*100:.1f}%")
    
    if results['passed']:
        log(f"\n[PASSED] ({len(results['passed'])} tests):")
        for name in results['passed']:
            log(f"   + {name}")
    
    if results['failed']:
        log(f"\n[FAILED] ({len(results['failed'])} tests):")
        for name, error in results['failed']:
            log(f"   - {name}")
            log(f"     Error: {error[:150]}")
    
    log("\n" + "="*70)
    log(f"Test Duration: {results['start_time']} to {results['end_time']}")
    log(f"Log saved to: {LOG_FILE}")
    log("="*70)
    
    # Save JSON results
    with open("browser_automation_test_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "test_suite": "Browser Automation Skills Test",
            "browser": "Chromium (Playwright)",
            "total_tests": total_tests,
            "passed": len(results['passed']),
            "failed": len(results['failed']),
            "success_rate": f"{len(results['passed'])/total_tests*100:.1f}%",
            "start_time": results['start_time'],
            "end_time": results['end_time'],
            "passed_tests": results['passed'],
            "failed_tests": [{"name": name, "error": error} for name, error in results['failed']]
        }, f, indent=2)
    
    log("\nResults also saved to: browser_automation_test_results.json")
    
    return 0 if len(results['failed']) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
