---
name: makepad-atlas
description: Comprehensive Makepad framework orchestrator. Covers Makepad DSL, widgets, layout, animation, shaders, and Makepad development. Use when building Makepad applications.
---

## PRIMACY ZONE — Identity and Purpose

**What this atlas contains**

Makepad-atlas orchestrates Makepad framework development skills for building high-performance native desktop and mobile applications with Rust. Makepad uses GPU shaders for rendering and focuses on native performance, creative tools, graphics-heavy apps, and VR/AR. Can also target web via WebAssembly, but primary focus is native.

**Use this atlas when**

- Building native desktop apps (Windows, macOS, Linux)
- Creating native mobile apps (iOS, Android) with Rust
- Developing creative tools and graphics-heavy applications
- Building VR/AR experiences
- Need GPU-first rendering with custom shaders
- Want Rust's performance and safety for UI applications
- Targeting web via WebAssembly (secondary use case)

**Do not use this atlas when**

- Building web apps with HTML/CSS/JavaScript (use frontend-atlas)
- Building mobile apps with JavaScript/React (use react-atlas for React Native)
- Backend services (use backend-atlas)
- General Rust development without UI (use rust-pro)

---

## MIDDLE ZONE — Available Skills

### Fundamentals

| Skill | Purpose |
|-------|---------|
| **makepad-basics** | Makepad fundamentals, setup, basics |
| **makepad-skills** | General Makepad development |
| **makepad-reference** | Makepad API reference |

### DSL & Widgets

| Skill | Purpose |
|-------|---------|
| **makepad-dsl** | Makepad DSL syntax, structure |
| **makepad-widgets** | Makepad widgets, components |

### Layout & Design

| Skill | Purpose |
|-------|---------|
| **makepad-layout** | Layout system, positioning |
| **makepad-font** | Typography, fonts |

### Animation & Interaction

| Skill | Purpose |
|-------|---------|
| **makepad-animation** | Animations, transitions |
| **makepad-event-action** | Event handling, user interaction |

### Advanced

| Skill | Purpose |
|-------|---------|
| **makepad-shaders** | Custom shaders, GPU programming |
| **makepad-platform** | Platform-specific features |

### Deployment

| Skill | Purpose |
|-------|---------|
| **makepad-deployment** | Building, deploying Makepad apps |
| **makepad-splash** | Splash screens, app icons |

### UI Patterns

| Skill | Purpose |
|-------|---------|
| **scroll-experience** | Scroll interactions (shared with frontend-atlas) |

---

## Related External Skills

### Core Development

- **rust-pro** — Rust programming, language features, patterns
- **ui-ux-designer** (frontend-atlas) — UI/UX design principles
- **frontend-patterns** (frontend-atlas) — UI patterns and best practices

### Cross-Platform Development

- **react-native-architecture** (react-atlas) — Mobile app architecture patterns
- **game-development** — Game mechanics and interactive experiences

### Framework Comparison

**Makepad vs Frontend-atlas (Web):**
| Aspect | Makepad | Frontend-atlas |
|--------|---------|----------------|
| **Platform** | Native desktop + mobile (+ web via WASM) | Web browser only |
| **Language** | Rust | JavaScript/TypeScript |
| **Rendering** | GPU shaders, native | HTML/CSS/DOM |
| **Use case** | Creative tools, graphics apps, VR/AR | Web applications |
| **Performance** | Native compiled, GPU-first | Browser-based |

**Makepad vs React Native:**
| Aspect | Makepad | React Native |
|--------|---------|--------------|
| **Platform** | Desktop + mobile | Mobile only (iOS/Android) |
| **Language** | Rust | JavaScript/React |
| **Rendering** | GPU shaders | Native components via bridge |
| **Use case** | Creative tools, desktop apps, graphics | Mobile apps with React |
| **Performance** | Compiled native, GPU-first | JS bridge to native |

**When to use Makepad:**
- High-performance native desktop apps
- Creative tools and graphics-heavy applications
- VR/AR experiences
- Need GPU-first rendering with custom shaders
- Want Rust's safety and performance
- Cross-platform desktop + mobile with single codebase

**When to use React Native instead:**
- Mobile-first apps (iOS/Android)
- Team familiar with React/JavaScript
- Need React ecosystem and libraries
- Standard mobile UI patterns

**When to use frontend-atlas instead:**
- Web applications running in browsers
- Need web ecosystem (npm, React, Vue, etc.)
- Standard web technologies (HTML/CSS/JS)

---

## Usage Patterns

**Building a Makepad app:**
1. makepad-basics (setup)
2. makepad-dsl (app structure)
3. makepad-widgets (UI components)
4. makepad-layout (layout)
5. makepad-event-action (interactions)
6. makepad-deployment (build)

**Custom widgets:**
1. makepad-widgets (widget basics)
2. makepad-dsl (widget DSL)
3. makepad-shaders (custom rendering)
4. makepad-animation (animations)

**Advanced graphics:**
1. makepad-shaders (write shaders)
2. makepad-animation (animations)
3. makepad-platform (platform features)

---

## Quick Reference

**Most used:** makepad-basics, makepad-dsl, makepad-widgets, makepad-layout

**External skills:** rust-pro, ui-ux-designer

**Remember:** Makepad-atlas focuses on Makepad framework. For Rust programming, use rust-pro. For UI/UX design, use ui-ux-designer from frontend-atlas.
