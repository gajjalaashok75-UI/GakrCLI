---
name: animejs-atlas
description: Comprehensive Anime.js 4 reference atlas for building, debugging, or explaining Anime.js animations. Use when Codex needs official-docs-aligned guidance for Anime.js installation, imports, animate(), timers, timelines, animatable objects, draggable/layout/scope modules, scroll events, SVG, text, utilities, easings, WAAPI, or engine tuning.
---

# Anime.js Atlas

Use this atlas as the entry point for Anime.js 4 work. Load the topic folder that matches the user request, and treat each topic file as a section-complete, paraphrased companion to the official docs.

Each topic file is expected to carry:

- the official page URL
- direct section and subsection links
- parameter and return coverage where the docs provide it
- fresh JS/HTML/CSS examples instead of copied doc snippets
- notes where the official docs themselves are ambiguous or inconsistent

## How to use this atlas

- Start with [references/official-docs-map.md](references/official-docs-map.md) if you want the source inventory before opening a topic file.
- Start with [getting-started/SKILL.md](getting-started/SKILL.md) for installation, import patterns, vanilla JS, and React setup.
- Load [animation/SKILL.md](animation/SKILL.md) for `animate()` targets, properties, keyframes, callbacks, methods, and playback settings.
- Load [timer/SKILL.md](timer/SKILL.md) when the task is about synchronized timing, loops, or callback scheduling without sequencing multiple tracks.
- Load [timeline/SKILL.md](timeline/SKILL.md) when the task is about orchestration, labels, relative positions, nesting, or mixed animation/timer flows.
- Load [animatable/SKILL.md](animatable/SKILL.md) when the task involves custom animatable values or object-like state containers.
- Load [draggable/SKILL.md](draggable/SKILL.md) for gesture-driven motion, release physics, snapping, and constrained drag interactions.
- Load [layout/SKILL.md](layout/SKILL.md) for auto-layout transitions, enter/leave/swap states, and layout id patterns.
- Load [scope/SKILL.md](scope/SKILL.md) for React-safe setup, cleanup, scoped selectors, and media-query aware orchestration.
- Load [events/SKILL.md](events/SKILL.md) for scroll observers, sync modes, thresholds, and scroll callbacks.
- Load [SVG/SKILL.md](SVG/SKILL.md) for morphing, motion-path helpers, and drawable path workflows.
- Load [text/SKILL.md](text/SKILL.md) for `splitText()`, accessibility choices, and reusable text effects.
- Load [utilities/SKILL.md](utilities/SKILL.md) for `stagger()`, DOM helpers, randomization, math helpers, and modifier utilities.
- Load [easings/SKILL.md](easings/SKILL.md) for built-in eases, Bezier curves, steps, irregular curves, and spring easing.
- Load [WAAPI/SKILL.md](WAAPI/SKILL.md) to compare `waapi.animate()` against `animate()`, understand WAAPI improvements, and convert Anime.js eases for native playback.
- Load [engine/SKILL.md](engine/SKILL.md) when the task involves engine speed, fps, precision, visibility pausing, or engine defaults.

## Coverage map

- Getting started: Installation, module imports, vanilla JS, React.
- Animation: Targets, animatable properties, tween values, tween parameters, keyframes, playback settings, callbacks, methods, properties.
- Timer: Playback settings, callbacks, methods, properties.
- Timeline: Add/sync APIs, positions, playback settings, callbacks, methods, properties.
- Animatable: Settings, getters, setters, revert, properties.
- Draggable: Axes parameters, settings, callbacks, methods, properties.
- Layout: Usage modes, settings, states, methods, layout id, callbacks, properties, common gotchas.
- Scope: Constructor and method registration, parameters, methods, properties.
- Events: `onScroll()` settings, thresholds, sync modes, callbacks, methods, properties.
- SVG: `morphTo`, `createDrawable`, `createMotionPath`.
- Text: `splitText()` settings, split parameters, HTML template, methods, properties.
- Utilities: `stagger()`, selectors, getters/setters, cleanup helpers, sync helpers, randomizers, math helpers, unit helpers, chainable utilities.
- Easings: Built-in eases, cubic Bezier, linear, steps, irregular, spring.
- WAAPI: When to use WAAPI, hardware acceleration, Anime.js improvements, API differences, `convertEase()`.
- Engine: Parameters, methods, properties, engine defaults.

## Documentation style

- Treat the topic files as high-fidelity companions, not short summaries.
- Prefer the topic file's official subsection map before assuming coverage is complete.
- If a topic file calls out a docs inconsistency, treat that note as an intentional warning rather than an omission.
- Use the examples in the topic files as implementation starting points, not as tested fixtures.

## Routing guide

- "How do I install or import Anime.js?" -> [getting-started/SKILL.md](getting-started/SKILL.md)
- "How do I animate DOM properties or object values?" -> [animation/SKILL.md](animation/SKILL.md)
- "How do I sequence several moves together?" -> [timeline/SKILL.md](timeline/SKILL.md)
- "How do I run something on a loop or on every frame?" -> [timer/SKILL.md](timer/SKILL.md)
- "How do I make this draggable?" -> [draggable/SKILL.md](draggable/SKILL.md)
- "How do I animate layout changes?" -> [layout/SKILL.md](layout/SKILL.md)
- "How do I wire Anime.js into React safely?" -> [getting-started/SKILL.md](getting-started/SKILL.md) and [scope/SKILL.md](scope/SKILL.md)
- "How do I sync animation to scroll?" -> [events/SKILL.md](events/SKILL.md)
- "How do I animate SVG paths or text?" -> [SVG/SKILL.md](SVG/SKILL.md) or [text/SKILL.md](text/SKILL.md)
- "How do I reduce bundle size or use browser-native playback?" -> [WAAPI/SKILL.md](WAAPI/SKILL.md)
- "How do I tune easing, springs, or engine speed?" -> [easings/SKILL.md](easings/SKILL.md) or [engine/SKILL.md](engine/SKILL.md)

## Source pages

These topic files are aligned to the official Anime.js documentation pages:

- Getting started: <https://animejs.com/documentation/getting-started>
- Timer: <https://animejs.com/documentation/timer>
- Animation: <https://animejs.com/documentation/animation>
- Timeline: <https://animejs.com/documentation/timeline>
- Animatable: <https://animejs.com/documentation/animatable>
- Draggable: <https://animejs.com/documentation/draggable>
- Layout: <https://animejs.com/documentation/layout>
- Scope: <https://animejs.com/documentation/scope>
- Events: <https://animejs.com/documentation/events>
- SVG: <https://animejs.com/documentation/svg>
- Text: <https://animejs.com/documentation/text>
- Utilities: <https://animejs.com/documentation/utilities>
- Easings: <https://animejs.com/documentation/easings>
- Web Animation API: <https://animejs.com/documentation/web-animation-api>
- Engine: <https://animejs.com/documentation/engine>

For the local-to-official source inventory, use [references/official-docs-map.md](references/official-docs-map.md).

## Practical defaults

- Prefer subpath imports when the task benefits from tree shaking or module-specific examples.
- Prefer `transform` and `opacity` for cheaper visual updates.
- Prefer `createScope()` for React components or reusable widgets that need cleanup.
- Prefer `createTimeline()` when multiple animations, timers, and callbacks must stay in lockstep.
- Prefer `waapi.animate()` when the feature set is sufficient and bundle size or browser-native playback matters.
- Prefer the JS `animate()` API when you need the richer Anime.js-only features marked in the module docs.
