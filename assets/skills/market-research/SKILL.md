---
name: market-research
description: Conduct market research, competitive analysis, investor due diligence, and industry intelligence with source attribution and decision-oriented summaries. Use when the user wants market sizing, competitor comparisons, fund research, technology scans, or research that informs business decisions.
---

# Market Research

Produce research that supports decisions, not research theater.

## When to Activate

- researching a market, category, company, investor, or technology trend
- building TAM/SAM/SOM estimates
- comparing competitors or adjacent products
- preparing investor dossiers before outreach
- pressure-testing a thesis before building, funding, or entering a market

## Research Standards

1. Every important claim needs a source.
2. Prefer recent data and call out stale data.
3. Include contrarian evidence and downside cases.
4. Translate findings into a decision, not just a summary.
5. Separate fact, inference, and recommendation clearly.

## Common Research Modes

### Investor / Fund Diligence
Collect:
- fund size, stage, and typical check size
- relevant portfolio companies
- public thesis and recent activity
- reasons the fund is or is not a fit
- any obvious red flags or mismatches

### Competitive Analysis
Collect:
- product reality, not marketing copy
- funding and investor history if public
- traction metrics if public
- distribution and pricing clues
- strengths, weaknesses, and positioning gaps

### Market Sizing
Use:
- top-down estimates from reports or public datasets
- bottom-up sanity checks from realistic customer acquisition assumptions
- explicit assumptions for every leap in logic

### Technology / Vendor Research
Collect:
- how it works
- trade-offs and adoption signals
- integration complexity
- lock-in, security, compliance, and operational risk

## Data Sources (data-extraction skill)

**For structured market data from specific platforms, use data-extraction:**

| Research Type | Data Source | Extraction Method |
|---------------|-------------|-------------------|
| **Competitor Products** | Amazon reviews, ProductHunt launches, G2/Capterra reviews | data-extraction/ecommerce-shopping + business-productivity |
| **Developer Tools** | GitHub stars/forks, Stack Overflow questions, npm downloads | data-extraction/developer-platforms + aggregators |
| **Market Sentiment** | Reddit discussions, Medium articles, Quora answers | data-extraction/social-media-content |
| **Pricing Intelligence** | Amazon/eBay pricing, Booking.com rates, e-commerce data | data-extraction/ecommerce-shopping |
| **Industry Trends** | GitHub trending, Hacker News discussions, Dev.to articles | data-extraction/developer-platforms |
| **Financial Data** | Crypto prices, economic indicators (FRED), market trends | data-extraction/data-apis + finance-markets |
| **Academic Research** | arXiv papers, PubMed studies, research citations | data-extraction/academic-research |
| **Event Intelligence** | Eventbrite listings, Coursera courses, ProductHunt launches | data-extraction/business-productivity |

**When to use:**
- **Competitive pricing** → Extract product prices from Amazon, eBay, e-commerce sites
- **Product reviews** → Gather user feedback from Amazon, G2, Capterra, Steam
- **Technology adoption** → Track GitHub stars, Stack Overflow questions, npm downloads
- **Market sentiment** → Analyze Reddit discussions, Medium articles, social media
- **Industry trends** → Monitor GitHub trending, Hacker News, developer platforms
- **Financial metrics** → Access crypto prices, economic data, market indicators

**Example workflow:**
```
Market Research: "SaaS project management tools"
1. Web search: Industry reports, analyst opinions
2. data-extraction/business-productivity/g2: Extract competitor reviews and ratings
3. data-extraction/business-productivity/producthunt: Recent launches and reception
4. data-extraction/developer-platforms/github: Open source alternatives and adoption
5. Synthesize: Combine all sources for comprehensive competitive analysis
```

## Output Format

Default structure:
1. executive summary
2. key findings
3. implications
4. risks and caveats
5. recommendation
6. sources

## Quality Gate

Before delivering:
- all numbers are sourced or labeled as estimates
- old data is flagged
- the recommendation follows from the evidence
- risks and counterarguments are included
- the output makes a decision easier
