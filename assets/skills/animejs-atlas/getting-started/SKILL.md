---
name: animejs-getting-started
description: Anime.js installation, module imports, vanilla JavaScript setup, and React integration guidance. Use when setting up Anime.js projects or choosing how to import and initialize Anime.js modules.
---

# Anime.js Getting Started

Use this companion when the task is about installing Anime.js 4, choosing an import style, or wiring it into a vanilla JS or React app. It follows the official getting-started docs section-by-section, but rewrites the guidance in atlas form and adds fresh examples.

## Official reference

- Landing page: <https://animejs.com/documentation/getting-started/>
- Installation: <https://animejs.com/documentation/getting-started/installation/>
- Module imports: <https://animejs.com/documentation/getting-started/module-imports/>
- Using with vanilla JS: <https://animejs.com/documentation/getting-started/using-with-vanilla-js/>
- Using with React: <https://animejs.com/documentation/getting-started/using-with-react/>

## Official subsection map

- Getting started index
  - Installation: <https://animejs.com/documentation/getting-started/installation/>
  - Module imports: <https://animejs.com/documentation/getting-started/module-imports/>
  - Using with vanilla JS: <https://animejs.com/documentation/getting-started/using-with-vanilla-js/>
  - Using with React: <https://animejs.com/documentation/getting-started/using-with-react/>
- Installation subsections
  - From NPM: <https://animejs.com/documentation/getting-started/installation/#from-npm>
  - From a CDN: <https://animejs.com/documentation/getting-started/installation/#from-a-cdn>
  - Direct download: <https://animejs.com/documentation/getting-started/installation/#direct-download>
  - Available Files: <https://animejs.com/documentation/getting-started/installation/#available-files>
- Module imports subsections
  - Importing from the main module: <https://animejs.com/documentation/getting-started/module-imports/#importing-from-the-main-module>
  - Importing from subpaths: <https://animejs.com/documentation/getting-started/module-imports/#importing-from-subpaths>
  - List of available subpaths: <https://animejs.com/documentation/getting-started/module-imports/#list-of-available-subpaths>
  - Importing ES modules without a bundler: <https://animejs.com/documentation/getting-started/module-imports/#importing-es-modules-without-a-bundler>
- Example subsections
  - Vanilla JS code example: <https://animejs.com/documentation/getting-started/using-with-vanilla-js/#using-with-vanilla-js-code-example>
  - React code example: <https://animejs.com/documentation/getting-started/using-with-react/#using-with-react-code-example>

## Page overview

The landing page is short: it frames this part of the docs as the place to learn how to download, install, and import Anime.js, and it routes readers into four sections:

- Installation
- Module imports
- Using with vanilla JS
- Using with React

The index page also points migrating users toward a separate migration guide.

---

## Installation

The docs show three official setup paths: package install, CDN delivery, and direct file download. The practical choice is:

- Prefer `npm install animejs` for apps using a bundler or modern framework.
- Prefer a CDN when you want a zero-build demo or quick prototype.
- Prefer direct download only when you need the files checked into a project or loaded from a custom path.

### From NPM

Install the package:

```bash
npm install animejs
```

After installation, the docs show two import styles from the package entry:

- ES modules

```javascript
import { animate } from 'animejs';
```

- CommonJS

```javascript
const { animate } = require('animejs');
```

Use the ES module form unless the codebase is still intentionally CommonJS.

### From a CDN

The docs list two module-friendly CDN entry points and one UMD build.

| Delivery mode | Official option | URL pattern |
| --- | --- | --- |
| ESM | `esm.sh` | `https://esm.sh/animejs` |
| ESM | `jsDelivr` | `https://cdn.jsdelivr.net/npm/animejs/+esm` |
| UMD global | `jsDelivr` | `https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js` |

Module import example:

```javascript
import { animate } from 'https://esm.sh/animejs';
```

Global-script example:

```html
<script src="https://cdn.jsdelivr.net/npm/animejs/dist/bundles/anime.umd.min.js"></script>
<script>
  const { animate } = anime;
</script>
```

### Direct download

The docs also support downloading the distribution files from the Anime.js repository and referencing them locally.

#### Available Files

| File | What it gives you |
| --- | --- |
| `dist/modules/index.js` | Main ES module entry |
| `dist/modules/index.cjs` | Main CommonJS entry |
| `dist/bundles/anime.esm.js` | Bundled ES module build |
| `dist/bundles/anime.esm.min.js` | Minified bundled ES module build |
| `dist/bundles/anime.umd.js` | Bundled UMD build |
| `dist/bundles/anime.umd.min.js` | Minified bundled UMD build |

Local ES module import:

```javascript
import { animate } from './animejs/dist/bundles/anime.esm.min.js';
```

Local UMD script tag:

```html
<script src="animejs/dist/bundles/anime.umd.min.js"></script>
<script>
  const { animate } = anime;
</script>
```

### Install choice guide

- Use the package entry when tree shaking, framework integration, or version pinning matters.
- Use the CDN ESM entry when you want `type="module"` without a build step.
- Use the UMD build only when the page expects globals instead of imports.

---

## Module imports

The docs position Anime.js as a modules-first library with good tree-shaking support. There are four official ideas to carry forward:

- You can import from the main `animejs` package entry.
- You can import only the pieces you need from subpaths.
- The subpath approach helps when bundling is limited or tree shaking is not reliable.
- You can map those modules in the browser with `importmap` and skip a bundler entirely.

### Importing from the main module

This is the simplest package import style. It works well when your build already handles tree shaking.

```javascript
import { animate, splitText, stagger, random } from 'animejs';

const { words } = splitText('.headline', {
  chars: false,
});

animate(words, {
  y: ['1rem', 0],
  opacity: [0, 1],
  rotate: () => random(-3, 3),
  delay: stagger(45),
  ease: 'out(3)',
});
```

### Importing from subpaths

Use subpaths when you want the import itself to declare exactly which module is in play.

```javascript
import { animate } from 'animejs/animation';
import { splitText } from 'animejs/text';
import { stagger } from 'animejs/utils';

const { chars } = splitText('.kicker');

animate(chars, {
  scale: [0.6, 1],
  opacity: [0, 1],
  delay: stagger(30),
  ease: 'outExpo',
});
```

This style is especially helpful in demos, docs, or no-bundler environments where you want to avoid pulling the full library surface into every file.

### List of available subpaths

The docs enumerate these official module entry points:

| Subpath | Primary export family | Atlas follow-up |
| --- | --- | --- |
| `animejs/animation` | `animate()` | `../animation/SKILL.md` |
| `animejs/timer` | `createTimer()` | `../timer/SKILL.md` |
| `animejs/timeline` | `createTimeline()` | `../timeline/SKILL.md` |
| `animejs/animatable` | `createAnimatable()` | `../animatable/SKILL.md` |
| `animejs/draggable` | `createDraggable()` | `../draggable/SKILL.md` |
| `animejs/layout` | `createLayout()` | `../layout/SKILL.md` |
| `animejs/scope` | `createScope()` | `../scope/SKILL.md` |
| `animejs/engine` | `engine` | `../engine/SKILL.md` |
| `animejs/events` | scroll/event helpers | `../events/SKILL.md` |
| `animejs/easings` | easing utilities | `../easings/SKILL.md` |
| `animejs/utils` | DOM, stagger, math, random helpers | `../utilities/SKILL.md` |
| `animejs/svg` | SVG helpers | `../SVG/SKILL.md` |
| `animejs/text` | text helpers | `../text/SKILL.md` |
| `animejs/waapi` | WAAPI helpers | `../WAAPI/SKILL.md` |

Representative import block:

```javascript
import { animate } from 'animejs/animation';
import { createTimeline } from 'animejs/timeline';
import { createDraggable } from 'animejs/draggable';
import * as utils from 'animejs/utils';
```

### Importing ES modules without a bundler

The docs show `importmap` as the browser-native way to map Anime.js entry points.

Minimal example:

```html
<script type="importmap">
{
  "imports": {
    "animejs": "/node_modules/animejs/dist/modules/index.js",
    "animejs/animation": "/node_modules/animejs/dist/modules/animation/index.js",
    "animejs/utils": "/node_modules/animejs/dist/modules/utils/index.js"
  }
}
</script>

<script type="module">
  import { animate } from 'animejs/animation';
  import { stagger } from 'animejs/utils';

  animate('.meter span', {
    scaleX: [0, 1],
    delay: stagger(80),
    ease: 'out(2)',
  });
</script>
```

If you need more than those three entries, extend the import map with the other official subpaths listed above. The docs explicitly show that `animejs`, `animejs/animation`, `animejs/timer`, `animejs/timeline`, `animejs/animatable`, `animejs/draggable`, `animejs/layout`, `animejs/scope`, `animejs/engine`, `animejs/events`, `animejs/easings`, `animejs/utils`, `animejs/svg`, `animejs/text`, and `animejs/waapi` all resolve to `dist/modules/.../index.js` paths.

### Import pattern guide

- Prefer `from 'animejs'` when the app already bundles well and you want the shortest imports.
- Prefer subpaths when authoring guides, component libraries, or environments where import precision matters.
- Prefer `importmap` for browser demos, static sites, or teaching examples that should run without Vite, esbuild, or similar tooling.

---

## Using with vanilla JS

The docs describe the vanilla setup as direct: import what you need, then animate immediately. The official example combines four ideas:

- module imports
- DOM selection helpers
- a looping animation
- interactivity via `createDraggable()` and a button click

### Using with vanilla JS code example

This fresh example keeps the same concepts but uses a different mini-demo.

```javascript
import { animate, utils, createDraggable, spring } from 'animejs';

const [badge] = utils.$('.orbit-badge');
const [button] = utils.$('[data-launch]');
let launches = 0;

animate('.orbit-badge', {
  y: [
    { to: '-0.8rem', duration: 220, ease: 'inOut(3)' },
    { to: 0, ease: spring({ bounce: 0.55 }) }
  ],
  loop: true,
  loopDelay: 280,
});

createDraggable('.orbit-badge', {
  container: [24, 24, 24, 24],
  releaseEase: spring({ bounce: 0.65 }),
});

button.addEventListener('click', () => {
  launches += 1;
  button.textContent = `launches: ${launches}`;

  animate(badge, {
    rotate: launches * 180,
    scale: [
      { to: 1.12, duration: 140 },
      { to: 1, ease: 'out(3)' }
    ],
    duration: 900,
    ease: 'out(4)',
  });
});
```

```html
<section class="demo-panel">
  <div class="orbit-badge" aria-hidden="true">A</div>
  <fieldset class="controls">
    <button type="button" data-launch>launches: 0</button>
  </fieldset>
</section>
```

```css
.demo-panel {
  display: grid;
  place-items: center;
  gap: 1rem;
  min-height: 18rem;
}

.orbit-badge {
  display: grid;
  place-items: center;
  width: 5rem;
  aspect-ratio: 1;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffd166, #ef476f);
  color: #1f2430;
  font: 700 1.5rem/1 sans-serif;
  cursor: grab;
  user-select: none;
}

.controls button {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 999px;
  background: #1f2430;
  color: #f7f7f2;
}
```

### Vanilla JS working notes

- `utils.$()` is handy when you want Anime.js-style DOM selection instead of `querySelector`.
- `createDraggable()` can live beside regular `animate()` calls in the same file.
- Event-driven `animate()` calls are a good default for button-triggered motion or small UI flourishes.

---

## Using with React

The docs recommend pairing React's `useEffect()` with Anime.js `createScope()` so that selectors stay scoped to the component and cleanup is automatic. The official example also demonstrates:

- a `root` ref for scoping
- a `scope` ref for later method access
- `self.add()` for registering callable methods
- cleanup through `scope.current.revert()`

### Using with React code example

This fresh example keeps the same structure while swapping in a different component.

```javascript
import { animate, createScope, createDraggable, spring } from 'animejs';
import { useEffect, useRef, useState } from 'react';
import './App.css';

export default function App() {
  const root = useRef(null);
  const scope = useRef(null);
  const [orbits, setOrbits] = useState(0);

  useEffect(() => {
    scope.current = createScope({ root }).add((self) => {
      animate('.planet', {
        scale: [
          { to: 1.08, duration: 240, ease: 'inOut(2)' },
          { to: 1, ease: spring({ bounce: 0.45 }) }
        ],
        loop: true,
        loopDelay: 320,
      });

      createDraggable('.planet', {
        container: [24, 24, 24, 24],
        releaseEase: spring({ bounce: 0.6 }),
      });

      self.add('orbitOnce', (count) => {
        animate('.planet', {
          rotate: count * 270,
          x: count % 2 ? 18 : -18,
          duration: 1000,
          ease: 'out(4)',
        });
      });
    });

    return () => scope.current.revert();
  }, []);

  const handleClick = () => {
    setOrbits((prev) => {
      const next = prev + 1;
      scope.current.methods.orbitOnce(next);
      return next;
    });
  };

  return (
    <section ref={root} className="demo-shell">
      <div className="planet-wrap">
        <div className="planet" aria-hidden="true" />
      </div>
      <button className="launch-button" onClick={handleClick}>
        orbits: {orbits}
      </button>
    </section>
  );
}
```

```css
.demo-shell {
  display: grid;
  place-items: center;
  gap: 1rem;
  min-height: 20rem;
}

.planet-wrap {
  display: grid;
  place-items: center;
  width: 12rem;
  aspect-ratio: 1;
}

.planet {
  width: 5rem;
  aspect-ratio: 1;
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, #fef3c7, #f59e0b 45%, #c2410c 100%);
  box-shadow: 0 1rem 2rem rgba(194, 65, 12, 0.28);
  cursor: grab;
}

.launch-button {
  padding: 0.75rem 1rem;
  border: 0;
  border-radius: 999px;
  background: #111827;
  color: white;
}
```

### React working notes

- `createScope({ root })` keeps selector-based animations local to the component instance.
- `self.add()` is the bridge between setup-time animation code and click handlers or other callbacks that run later.
- Always return `scope.current.revert()` from the effect cleanup so scoped instances are torn down when the component unmounts.

---

## Quick decisions

- "I just need Anime.js in a normal app" -> install `animejs` and import from `'animejs'`.
- "I care about very explicit module boundaries" -> import from subpaths like `'animejs/animation'`.
- "I want a demo with no bundler" -> use a CDN module URL or an `importmap`.
- "I am animating inside React components" -> use `createScope()` and clean up with `revert()`.

## Next skill to load

- `animate()` details -> [../animation/SKILL.md](../animation/SKILL.md)
- timelines -> [../timeline/SKILL.md](../timeline/SKILL.md)
- draggable interactions -> [../draggable/SKILL.md](../draggable/SKILL.md)
- text splitting -> [../text/SKILL.md](../text/SKILL.md)
- React-safe scoping -> [../scope/SKILL.md](../scope/SKILL.md)
