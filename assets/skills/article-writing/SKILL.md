---
name: article-writing
description: Write articles, guides, blog posts, tutorials, newsletter issues, and other long-form content in a distinctive voice derived from supplied examples or brand guidance. Use when the user wants polished written content longer than a paragraph, especially when voice consistency, structure, and credibility matter.
---

# Article Writing

Write long-form content that sounds like a real person or brand, not generic AI output.

## When to Activate

- drafting blog posts, essays, launch posts, guides, tutorials, or newsletter issues
- turning notes, transcripts, or research into polished articles
- matching an existing founder, operator, or brand voice from examples
- tightening structure, pacing, and evidence in already-written long-form copy

## Core Rules

1. Lead with the concrete thing: example, output, anecdote, number, screenshot description, or code block.
2. Explain after the example, not before.
3. Prefer short, direct sentences over padded ones.
4. Use specific numbers when available and sourced.
5. Never invent biographical facts, company metrics, or customer evidence.

## Voice Capture Workflow

If the user wants a specific voice, collect one or more of:
- published articles
- newsletters
- X / LinkedIn posts
- docs or memos
- a short style guide

Then extract:
- sentence length and rhythm
- whether the voice is formal, conversational, or sharp
- favored rhetorical devices such as parentheses, lists, fragments, or questions
- tolerance for humor, opinion, and contrarian framing
- formatting habits such as headers, bullets, code blocks, and pull quotes

If no voice references are given, default to a direct, operator-style voice: concrete, practical, and low on hype.

## Banned Patterns

Delete and rewrite any of these:
- generic openings like "In today's rapidly evolving landscape"
- filler transitions such as "Moreover" and "Furthermore"
- hype phrases like "game-changer", "cutting-edge", or "revolutionary"
- vague claims without evidence
- biography or credibility claims not backed by provided context

## Writing Process

1. Clarify the audience and purpose.
2. Build a skeletal outline with one purpose per section.
3. Start each section with evidence, example, or scene.
4. Expand only where the next sentence earns its place.
5. Remove anything that sounds templated or self-congratulatory.

## Research & Data Gathering (data-extraction skill)

**For articles requiring real-world data, examples, or current information:**

| Article Type | Data Needed | Extraction Method |
|--------------|-------------|-------------------|
| **Tech Tutorials** | Code examples, GitHub repos, Stack Overflow solutions | data-extraction/developer-platforms |
| **Product Reviews** | User reviews, ratings, pricing, features | data-extraction/ecommerce-shopping + business-productivity |
| **Industry Analysis** | Market trends, GitHub activity, developer discussions | data-extraction/developer-platforms + social-media-content |
| **Research Articles** | Academic papers, citations, study data | data-extraction/academic-research |
| **Entertainment Content** | Music charts, game reviews, book ratings | data-extraction/entertainment-media |
| **Financial Writing** | Crypto prices, economic data, market trends | data-extraction/data-apis + finance-markets |
| **Social Commentary** | Reddit discussions, Medium articles, community sentiment | data-extraction/social-media-content |

**When to use before writing:**
- **Tech articles** → Extract code examples from GitHub, solutions from Stack Overflow
- **Product comparisons** → Gather reviews from Amazon, G2, Capterra
- **Trend pieces** → Monitor GitHub trending, Hacker News, Reddit discussions
- **Data-driven content** → Access weather, crypto, economic APIs for real numbers
- **Research-backed** → Extract academic papers from arXiv, PubMed

**Workflow:**
1. **Research phase** → Use data-extraction to gather structured data
2. **Outline phase** → Organize extracted data into article structure
3. **Writing phase** → Transform data into narrative with voice
4. **Verification** → Cite sources from extracted data

**Example:**
```
Article: "State of React in 2026"
1. data-extraction/developer-platforms/github → Extract trending React repos
2. data-extraction/developer-platforms/stackoverflow → Get common React questions
3. data-extraction/social-media-content/reddit → Gather developer sentiment
4. Write article using real data, examples, and community insights
```

## Structure Guidance

### Technical Guides
- open with what the reader gets
- use code or terminal examples in every major section
- end with concrete takeaways, not a soft summary

### Essays / Opinion Pieces
- start with tension, contradiction, or a sharp observation
- keep one argument thread per section
- use examples that earn the opinion

### Newsletters
- keep the first screen strong
- mix insight with updates, not diary filler
- use clear section labels and easy skim structure

## Quality Gate

Before delivering:
- verify factual claims against provided sources
- remove filler and corporate language
- confirm the voice matches the supplied examples
- ensure every section adds new information
- check formatting for the intended platform
