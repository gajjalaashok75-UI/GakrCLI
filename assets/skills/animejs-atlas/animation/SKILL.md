---
name: animejs-animation
description: Anime.js animate() reference covering targets, animatable properties, tween values, tween parameters, keyframes, playback settings, callbacks, methods, and properties. Use when building or debugging core Anime.js animations.
---

# Anime.js Animation Docs Companion

Official page: <https://animejs.com/documentation/animation/>

This file is a section-complete, paraphrased companion to the official Anime.js Animation docs page and its linked subsections. It covers:

- `animate()` setup and imports
- Targets
- Animatable properties
- Tween value types
- Tween parameters
- Keyframes
- Playback settings
- Callbacks
- Methods
- Animation instance properties

Use this as a practical map of the official docs, not a replacement for them.

## Imports, signature, parameters, returns

Official references:

- Main page: <https://animejs.com/documentation/animation/>
- `animate()` subpath import note: <https://animejs.com/documentation/getting-started/module-imports/>
- WAAPI guide mentioned by the page: <https://animejs.com/documentation/web-animation-api/>

Primary imports:

```js
import { animate } from 'animejs';
import { animate as animateOnly } from 'animejs/animation';
import { waapi, engine, utils, stagger, eases, spring } from 'animejs';
```

Core signatures:

```js
const animation = animate(targets, parameters);
const waapiAnimation = waapi.animate(targets, parameters);
```

Official parameter contract:

| Name | Accepts |
| --- | --- |
| `targets` | Any supported [Targets](https://animejs.com/documentation/animation/targets/) input |
| `parameters` | An object that mixes animatable properties, tween parameters, playback settings, and callbacks |

Official return:

- `animate()` returns `JSAnimation`
- The page also points to `waapi.animate()` as a smaller WAAPI-backed alternative with less feature coverage

## Quick start example

This example intentionally mixes property keyframes, local tween params, staggered delay, and looping.

```html
<section class="hero">
  <h2 class="headline">
    <span class="glyph">A</span>
    <span class="glyph">N</span>
    <span class="glyph">I</span>
    <span class="glyph">M</span>
    <span class="glyph">E</span>
  </h2>
</section>
```

```css
.hero {
  min-height: 180px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #f8fafc;
}

.headline {
  display: flex;
  gap: 0.2em;
  font: 700 2.25rem/1.1 Georgia, serif;
  letter-spacing: 0.04em;
}

.glyph {
  display: inline-block;
  transform-origin: 50% 100%;
}
```

```js
import { animate, stagger } from 'animejs';

animate('.glyph', {
  y: [
    { to: '-2rem', ease: 'outExpo', duration: 500 },
    { to: 0, ease: 'outBounce', duration: 700, delay: 120 },
  ],
  rotate: {
    from: '-0.75turn',
    delay: 0,
  },
  delay: stagger(60),
  ease: 'inOutCirc',
  loopDelay: 900,
  loop: true,
});
```

## Official section map

### Targets

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/targets/> |
| CSS Selector | <https://animejs.com/documentation/animation/targets/css-selector/> |
| DOM Elements | <https://animejs.com/documentation/animation/targets/dom-elements/> |
| JavaScript Objects | <https://animejs.com/documentation/animation/targets/javascript-objects/> |
| Array of targets | <https://animejs.com/documentation/animation/targets/array-of-targets/> |

### Animatable properties

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/animatable-properties/> |
| CSS Properties | <https://animejs.com/documentation/animation/animatable-properties/css-properties/> |
| CSS transforms | <https://animejs.com/documentation/animation/animatable-properties/css-transforms/> |
| CSS Variables | <https://animejs.com/documentation/animation/animatable-properties/css-variables/> |
| JavaScript Object properties | <https://animejs.com/documentation/animation/animatable-properties/javascript-object-properties/> |
| HTML Attributes | <https://animejs.com/documentation/animation/animatable-properties/html-attributes/> |
| SVG Attributes | <https://animejs.com/documentation/animation/animatable-properties/svg-attributes/> |

### Tween value types

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/tween-value-types/> |
| Numerical value | <https://animejs.com/documentation/animation/tween-value-types/numerical-value/> |
| Unit conversion value | <https://animejs.com/documentation/animation/tween-value-types/unit-conversion-value/> |
| Relative value | <https://animejs.com/documentation/animation/tween-value-types/relative-value/> |
| Color value | <https://animejs.com/documentation/animation/tween-value-types/color-value/> |
| Color function value | <https://animejs.com/documentation/animation/tween-value-types/color-function-value/> |
| CSS variable | <https://animejs.com/documentation/animation/tween-value-types/css-variable/> |
| Function based value | <https://animejs.com/documentation/animation/tween-value-types/function-based/> |

### Tween parameters

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/tween-parameters/> |
| `to` | <https://animejs.com/documentation/animation/tween-parameters/to/> |
| `from` | <https://animejs.com/documentation/animation/tween-parameters/from/> |
| `delay` | <https://animejs.com/documentation/animation/tween-parameters/delay/> |
| `duration` | <https://animejs.com/documentation/animation/tween-parameters/duration/> |
| `ease` | <https://animejs.com/documentation/animation/tween-parameters/ease/> |
| `composition` | <https://animejs.com/documentation/animation/tween-parameters/composition/> |
| `modifier` | <https://animejs.com/documentation/animation/tween-parameters/modifier/> |

### Keyframes

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/keyframes/> |
| Tween values keyframes | <https://animejs.com/documentation/animation/keyframes/tween-values-keyframes/> |
| Tween parameters keyframes | <https://animejs.com/documentation/animation/keyframes/tween-parameters-keyframes/> |
| Duration based keyframes | <https://animejs.com/documentation/animation/keyframes/duration-based-keyframes/> |
| Percentage based keyframes | <https://animejs.com/documentation/animation/keyframes/percentage-based-keyframes/> |

### Playback settings

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/animation-playback-settings/> |
| `delay` | <https://animejs.com/documentation/animation/animation-playback-settings/delay/> |
| `duration` | <https://animejs.com/documentation/animation/animation-playback-settings/duration/> |
| `loop` | <https://animejs.com/documentation/animation/animation-playback-settings/loop/> |
| `loopDelay` | <https://animejs.com/documentation/animation/animation-playback-settings/playback-loopdelay/> |
| `alternate` | <https://animejs.com/documentation/animation/animation-playback-settings/alternate/> |
| `reversed` | <https://animejs.com/documentation/animation/animation-playback-settings/reversed/> |
| `autoplay` | <https://animejs.com/documentation/animation/animation-playback-settings/autoplay/> |
| `frameRate` | <https://animejs.com/documentation/animation/animation-playback-settings/framerate/> |
| `playbackRate` | <https://animejs.com/documentation/animation/animation-playback-settings/playbackrate/> |
| `playbackEase` | <https://animejs.com/documentation/animation/animation-playback-settings/playbackease/> |
| `persist` | <https://animejs.com/documentation/animation/animation-playback-settings/persist/> |

### Callbacks

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/animation-callbacks/> |
| `onBegin` | <https://animejs.com/documentation/animation/animation-callbacks/onbegin/> |
| `onComplete` | <https://animejs.com/documentation/animation/animation-callbacks/oncomplete/> |
| `onBeforeUpdate` | <https://animejs.com/documentation/animation/animation-callbacks/onbeforeupdate/> |
| `onUpdate` | <https://animejs.com/documentation/animation/animation-callbacks/onupdate/> |
| `onRender` | <https://animejs.com/documentation/animation/animation-callbacks/onrender/> |
| `onLoop` | <https://animejs.com/documentation/animation/animation-callbacks/onloop/> |
| `onPause` | <https://animejs.com/documentation/animation/animation-callbacks/onpause/> |
| `then()` | <https://animejs.com/documentation/animation/animation-callbacks/then/> |

### Methods

| Subsection | Official link |
| --- | --- |
| Overview | <https://animejs.com/documentation/animation/animation-methods/> |
| `play()` | <https://animejs.com/documentation/animation/animation-methods/play/> |
| `reverse()` | <https://animejs.com/documentation/animation/animation-methods/reverse/> |
| `pause()` | <https://animejs.com/documentation/animation/animation-methods/pause/> |
| `restart()` | <https://animejs.com/documentation/animation/animation-methods/restart/> |
| `alternate()` | <https://animejs.com/documentation/animation/animation-methods/alternate/> |
| `resume()` | <https://animejs.com/documentation/animation/animation-methods/resume/> |
| `complete()` | <https://animejs.com/documentation/animation/animation-methods/complete/> |
| `cancel()` | <https://animejs.com/documentation/animation/animation-methods/cancel/> |
| `revert()` | <https://animejs.com/documentation/animation/animation-methods/revert/> |
| `reset()` | <https://animejs.com/documentation/animation/animation-methods/reset/> |
| `seek()` | <https://animejs.com/documentation/animation/animation-methods/seek/> |
| `stretch()` | <https://animejs.com/documentation/animation/animation-methods/stretch/> |
| `refresh()` | <https://animejs.com/documentation/animation/animation-methods/refresh/> |

### Properties

| Subsection | Official link |
| --- | --- |
| Animation properties | <https://animejs.com/documentation/animation/animation-properties/> |

## Targets

Official overview: <https://animejs.com/documentation/animation/targets/>

Targets are the first argument passed to `animate()`. They decide where property changes are applied.

| Subsection | Accepts | Notes |
| --- | --- | --- |
| CSS Selector | Any string supported by `document.querySelectorAll()` | Best when the DOM already contains the full target set. |
| DOM Elements | `HTMLElement`, `SVGElement`, `SVGGeometryElement`, `NodeList` | Useful when you already have element references. |
| JavaScript Objects | Plain objects or class instances | JS-only. Good for animating data, not DOM. |
| Array of targets | An array of any valid targets | You can mix DOM nodes, selectors, and objects together. |

Fresh example:

```html
<div class="target-demo">
  <div class="box selector-box"></div>
  <div class="box dom-box"></div>
  <pre class="readout">{"x":0}</pre>
</div>
```

```css
.target-demo {
  display: grid;
  gap: 12px;
}

.box {
  width: 48px;
  height: 48px;
  background: #f97316;
}
```

```js
import { animate } from 'animejs';

const domBox = document.querySelector('.dom-box');
const state = { x: 0 };

animate('.selector-box', { x: '8rem' });
animate(domBox, { rotate: '1turn' });
animate(state, {
  x: 120,
  onUpdate: () => {
    document.querySelector('.readout').textContent = JSON.stringify(state);
  },
});

animate([domBox, state], {
  duration: 900,
  ease: 'outQuad',
});
```

## Animatable properties

Official overview: <https://animejs.com/documentation/animation/animatable-properties/>

Animatable properties live inside the `parameters` object. Anime.js separates them from playback settings and callbacks.

| Subsection | Accepts | Notes |
| --- | --- | --- |
| CSS Properties | Numeric and color CSS properties | Dashed names can be camelCased or written as strings. Prefer transforms and opacity for smoother rendering. |
| CSS transforms | Individual transform props like `x`, `translateX`, `scale`, `rotate`, `skew`, `perspective` | JS and WAAPI both support individual transform props. JS does not parse transform values from stylesheet rules; set inline transforms first if needed. |
| CSS Variables | CSS custom properties containing numeric or color values | JS-only. Also useful for pseudo-elements such as `::before` and `::after`. WAAPI needs `CSS.registerProperty()` for animated custom props. |
| JavaScript Object properties | Numeric and color fields on objects | JS-only. |
| HTML Attributes | Numeric and color HTML attributes | JS-only. |
| SVG Attributes | Numeric and color SVG attributes | JS-only. SVG helper utilities are often more ergonomic for advanced SVG work. |

Valid individual transform props listed by the docs:

| Property | Shorthand | Default unit |
| --- | --- | --- |
| `translateX` | `x` | `px` |
| `translateY` | `y` | `px` |
| `translateZ` | `z` | `px` |
| `rotate` / `rotateX` / `rotateY` / `rotateZ` | none | `deg` |
| `scale` / `scaleX` / `scaleY` / `scaleZ` | none | unitless |
| `skew` / `skewX` / `skewY` | none | `deg` |
| `perspective` | none | `px` |

Fresh example:

```html
<div class="property-demo">
  <div class="card"></div>
  <svg class="badge" viewBox="0 0 120 120" width="120" height="120">
    <polygon points="60 10 105 40 105 80 60 110 15 80 15 40" fill="currentColor"></polygon>
  </svg>
</div>
```

```css
.property-demo {
  display: flex;
  gap: 24px;
  align-items: center;
  color: #2563eb;
}

.card {
  --slide: 0rem;
  width: 64px;
  height: 64px;
  border-radius: var(--radius, 8px);
  background: #22c55e;
  transform: translateX(var(--slide));
  position: relative;
}

.card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgb(255 255 255 / 0.25);
  transform: scale(var(--halo-scale, 1));
}
```

```js
import { animate, utils, waapi } from 'animejs';

const dataPoint = { score: 10, tint: '#0ea5e9' };

utils.set('.card', {
  '--radius': '8px',
  '--slide': '0rem',
  '--halo-scale': '1',
  borderRadius: () => 'var(--radius)',
  translateX: () => 'var(--slide)',
});

animate('.card', {
  left: '2rem',
  backgroundColor: '#84cc16',
  '--radius': '18px',
  '--slide': '8rem',
  '--halo-scale': '1.35',
});

animate(dataPoint, {
  score: 88,
  tint: '#f97316',
});

animate('polygon', {
  points: '60 6 112 42 96 98 24 98 8 42',
  fill: '#1d4ed8',
});

waapi.animate('.card', {
  transform: 'translateX(8rem) rotate(1turn) scale(1.1)',
});
```

## Tween value types

Official overview: <https://animejs.com/documentation/animation/tween-value-types/>

Tween values define the start and end data that Anime.js interpolates.

| Subsection | Accepts | Notes |
| --- | --- | --- |
| Numerical value | `Number` or `String` containing a number | If a property needs a unit and none is given, Anime.js falls back to the property's default unit. JS animations can also inherit a previously used unit on the same property. |
| Unit conversion value | `String` | Useful when animating from one unit to another, but the docs warn JS unit conversion can be surprising. `utils.set()` or WAAPI can be safer. |
| Relative value | Strings prefixed with `+=`, `-=`, `*=` | JS-only. Offsets or multiplies the current value. |
| Color value | Hex, hexa, rgb, rgba, hsl, hsla strings | For animatable color properties. |
| Color function value | Valid CSS `color(...)` syntax | WAAPI-only. |
| CSS variable | `var(--token)` strings | JS animations cache the resolved value; call `refresh()` if the variable changes later. |
| Function based value | Function `(target, index, length) => value` | Can return either a tween value or a full tween parameter object. `refresh()` recomputes these values. |

Fresh example:

```html
<div class="value-demo">
  <div class="chip" data-x="5rem"></div>
  <div class="chip" data-x="9rem"></div>
  <div class="chip" data-x="13rem"></div>
</div>
```

```css
.value-demo {
  --accent-a: #f43f5e;
  --accent-b: #fb923c;
  display: grid;
  gap: 10px;
}

.chip {
  width: 40px;
  height: 40px;
  border: 6px solid currentColor;
  background: var(--accent-a);
  color: #0f172a;
}
```

```js
import { animate, utils, waapi } from 'animejs';

animate('.chip', {
  x: el => el.dataset.x,
  scale: '+=0.25',
  borderRadius: '50%',
  backgroundColor: ['#f43f5e', 'rgba(251, 146, 60, 0.35)'],
  rotate: '.5turn',
  delay: (_, i) => i * 120,
});

waapi.animate('.chip', {
  color: 'color(display-p3 0.1 0.2 0.8 / 1)',
});

const node = document.querySelector('.chip');
node.style.setProperty('--dynamic-x', '6rem');
const cached = animate(node, { x: 'var(--dynamic-x)' });
node.style.setProperty('--dynamic-x', '10rem');
cached.restart().refresh();
```

## Tween parameters

Official overview: <https://animejs.com/documentation/animation/tween-parameters/>

Tween parameters may be declared globally in the main parameter object or locally inside a specific property object.

| Parameter | Accepts | Default | Notes |
| --- | --- | --- | --- |
| `to` | Any tween value type, or a two-value keyframe array | Current target value if only `from` is provided | Local only. Required when `from` is absent. |
| `from` | Any tween value type | Current target value if only `to` is provided | Local only. Required when `to` is absent. |
| `delay` | Number `>= 0`, or function returning one | Inherits animation `delay` (default `0`) | Can be global or per-property. |
| `duration` | Number `>= 0`, or function returning one | Inherits animation `duration` (default `1000`) | Values above `1e12` are clamped internally. |
| `ease` | Easing function, built-in ease string, or function returning either | `'out(2)'` | Can be global or per-property. |
| `composition` | `'replace'`, `'none'`, `'blend'`, or `0`, `1`, `2` | Usually `'replace'`; JS may default to `'none'` on very large target sets | JS-only. Controls overlap behavior between animations touching the same target property. |
| `modifier` | Function `(value) => number` | `null` | JS-only. The numeric result is merged back with any unit/string suffix. |

Composition modes from the official docs:

| Mode | Meaning |
| --- | --- |
| `'replace'` or `0` | New animation replaces the running one |
| `'none'` or `1` | Existing animation keeps running; useful when overlap is okay |
| `'blend'` or `2` | Creates additive blended motion |

Fresh example:

```html
<div class="tween-demo">
  <div class="tile"></div>
</div>
```

```css
.tile {
  width: 56px;
  height: 56px;
  background: #38bdf8;
}
```

```js
import { animate, eases } from 'animejs';

animate('.tile', {
  x: {
    from: '-4rem',
    to: '12rem',
    delay: 150,
    duration: 900,
    ease: eases.outQuad,
  },
  rotate: {
    to: '1turn',
    duration: 600,
    composition: 'blend',
  },
  y: {
    to: '5rem',
    modifier: value => Math.round(value / 8) * 8,
  },
  delay: 100,
  duration: 1200,
  ease: 'inOut(3)',
});
```

## Keyframes

Official overview: <https://animejs.com/documentation/animation/keyframes/>

Anime.js supports both property-level and animation-level sequencing.

| Subsection | Accepts | Notes |
| --- | --- | --- |
| Tween values keyframes | Array of valid tween values | Property-level syntax. First item becomes the starting value. Total duration is split across transitions. |
| Tween parameters keyframes | Array of tween parameter objects | Property-level syntax with per-step `ease`, `delay`, `duration`, `modifier`. |
| Duration based keyframes | `keyframes: []` array of objects | JS-only. Each object includes one or more animatable properties, plus optional tween params. |
| Percentage based keyframes | `keyframes: { '0%': {...} }` object | JS-only. Keys are percentage strings; values hold animatable properties and optional `ease`. Similar to CSS `@keyframes`. |

Fresh example:

```html
<div class="keyframe-demo">
  <div class="dot"></div>
</div>
```

```css
.keyframe-demo {
  min-height: 120px;
}

.dot {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #8b5cf6;
}
```

```js
import { animate } from 'animejs';

animate('.dot', {
  x: ['0rem', '4rem', '8rem', '0rem'],
  scale: [
    { to: 1.4, duration: 350, ease: 'outQuad' },
    { to: 0.8, duration: 350, delay: 150 },
    { to: 1, duration: 250, ease: 'inQuad' },
  ],
  keyframes: {
    '0%': { y: '0rem' },
    '30%': { y: '-2rem', ease: 'out' },
    '70%': { y: '2rem' },
    '100%': { y: '0rem', ease: 'in' },
  },
  duration: 1800,
  playbackEase: 'inOut',
  loop: true,
});
```

## Playback settings

Official overview: <https://animejs.com/documentation/animation/animation-playback-settings/>

Playback settings live directly in the main parameter object and shape how the animation runs as a whole.

| Setting | Accepts | Default | Notes |
| --- | --- | --- | --- |
| `delay` | Number `>= 0`, or function returning one | `0` | Global tween start delay. Change the global default via `engine.defaults.delay`. |
| `duration` | Number `>= 0`, or function returning one | `1000` | `0` finishes immediately. Values above `1e12` are clamped. |
| `loop` | Number, `Infinity`, `true`, `-1` | `0` | Repetition count. `true`, `Infinity`, and `-1` all mean infinite looping. |
| `loopDelay` | Number `>= 0` | `0` | JS-only. Delay between loop iterations. |
| `alternate` | `Boolean` | `false` | Flips direction on each iteration when looping. |
| `reversed` | `Boolean` | `false` | Sets the initial direction to backward when true. |
| `autoplay` | `Boolean` or `onScroll()` | `true` | Ignored inside timelines because timeline children are forced to `false` autoplay. |
| `frameRate` | Number `> 0` | `120` | JS-only. Capped by display/browser limits. Can later be changed through `animation.fps`. |
| `playbackRate` | Number `>= 0` | `1` | Can later be changed through `animation.speed`. `0` effectively stops progression. |
| `playbackEase` | Same inputs as tween `ease` | `null` | JS-only. Applied over the whole playback rather than between individual tweens. |
| `persist` | `Boolean` | `false` | WAAPI-only. Keeps completed WAAPI animations alive instead of auto-canceling them. Scroll-controlled WAAPI animations set this to `true` automatically. |

Global defaults example:

```js
import { engine } from 'animejs';

engine.defaults.delay = 100;
engine.defaults.duration = 900;
engine.defaults.loop = 2;
engine.defaults.loopDelay = 250;
engine.defaults.alternate = true;
engine.defaults.reversed = false;
engine.defaults.autoplay = true;
engine.defaults.frameRate = 60;
engine.defaults.playbackRate = 1;
engine.defaults.playbackEase = 'inOut';
engine.defaults.persist = false;
```

Fresh example:

```html
<div class="playback-demo">
  <div class="ball"></div>
  <output class="speed-label">1.00x</output>
</div>
```

```css
.playback-demo {
  display: flex;
  gap: 16px;
  align-items: center;
}

.ball {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #ef4444;
}
```

```js
import { animate, utils } from 'animejs';

const playback = animate('.ball', {
  x: '14rem',
  scale: 1.5,
  delay: 200,
  duration: 1200,
  loop: true,
  loopDelay: 500,
  alternate: true,
  frameRate: 60,
  playbackRate: 1,
  playbackEase: 'inOut',
});

utils.sync(() => {
  playback.speed = 0.75;
  document.querySelector('.speed-label').value = '0.75x';
});
```

## Callbacks

Official overview: <https://animejs.com/documentation/animation/animation-callbacks/>

Callbacks are passed directly in the animation parameters object.

| Callback | Accepts | Default | Behavior |
| --- | --- | --- | --- |
| `onBegin` | Function whose first arg is the animation | `noop` | Fires when playback actually begins, after any starting delay. |
| `onComplete` | Function whose first arg is the animation | `noop` | Fires after every loop has finished. |
| `onBeforeUpdate` | Function whose first arg is the animation | `noop` | JS-only. Runs before tween values are updated on each frame. |
| `onUpdate` | Function whose first arg is the animation | `noop` | JS-only. Runs on each frame while the animation is active. |
| `onRender` | Function whose first arg is the animation | `noop` | JS-only. Runs only when something is actually rendered; not during `delay` or `loopDelay`. |
| `onLoop` | Function whose first arg is the animation | `noop` | JS-only. Fires when an iteration completes. |
| `onPause` | Function whose first arg is the animation | `noop` | JS-only. Fires for manual pauses and a few automatic pause scenarios. |
| `then(callback)` | `callback(animation)` | Returns `Promise` | Resolves when the animation completes. Works inline or with `await`. |

Official `onPause` notes worth remembering:

- It fires for `.pause()`, `.cancel()`, and `.revert()`
- It can also fire if all tweens are fully replaced by another animation using `composition: 'replace'`
- It can also fire if all targets disappear

Fresh example:

```html
<div class="callback-demo">
  <div class="pulse"></div>
  <pre class="events"></pre>
</div>
```

```css
.pulse {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: #14b8a6;
}
```

```js
import { animate } from 'animejs';

const log = document.querySelector('.events');
const append = label => {
  log.textContent += `${label}\n`;
};

const callbackAnimation = animate('.pulse', {
  x: '10rem',
  duration: 700,
  loop: 2,
  alternate: true,
  onBegin: self => append(`begin:${self.id}`),
  onBeforeUpdate: self => {
    if (self.progress < 0.05) append('before-update');
  },
  onUpdate: self => {
    if (self.progress > 0.5 && self.progress < 0.52) append('update');
  },
  onRender: () => append('render'),
  onLoop: self => append(`loop:${self.currentIteration}`),
  onPause: () => append('pause'),
  onComplete: () => append('complete'),
});

callbackAnimation.then(() => append('promise-fulfilled'));
```

## Methods

Official overview: <https://animejs.com/documentation/animation/animation-methods/>

Every method below returns the animation instance itself unless noted otherwise, so chaining is allowed.

| Method | Parameters | Returns | Summary |
| --- | --- | --- | --- |
| `play()` | none | animation | Forces forward playback. |
| `reverse()` | none | animation | Forces backward playback. |
| `pause()` | none | animation | Pauses a running animation. |
| `restart()` | none | animation | Resets properties and `currentTime` to `0`; autoplay decides whether playback resumes immediately. |
| `alternate()` | none | animation | Toggles direction and repositions `currentTime` to match the new direction. |
| `resume()` | none | animation | Resumes a paused animation in its current direction. |
| `complete()` | none | animation | Finishes instantly. |
| `cancel()` | none | animation | Pauses, removes the animation from the engine loop, and frees memory. |
| `revert()` | none | animation | Cancels, restores original values, cleans inline styles, and also reverts linked `onScroll()` instances if present. |
| `reset()` | `softReset = false` | animation | JS-only. Resets internal state like `currentTime`, `progress`, `reversed`, `began`, `completed`. |
| `seek()` | `time`, `muteCallbacks = false` | animation | Jumps to a specific `currentTime`. |
| `stretch()` | `duration` | animation | JS-only. Recomputes the total duration of the animation and its tweens. |
| `refresh()` | none | animation | JS-only. Recomputes function-based animatable property values. It does not refresh `duration` or `delay`. |

Fresh example:

```html
<div class="method-demo">
  <div class="runner"></div>
  <div class="controls">
    <button data-act="play">Play</button>
    <button data-act="pause">Pause</button>
    <button data-act="reverse">Reverse</button>
    <button data-act="seek">Seek 400</button>
    <button data-act="reset">Reset</button>
    <button data-act="revert">Revert</button>
  </div>
</div>
```

```css
.runner {
  width: 44px;
  height: 44px;
  background: #a855f7;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
```

```js
import { animate, utils } from 'animejs';

utils.set('.runner', { x: '0rem' });

const controlled = animate('.runner', {
  x: () => `${utils.random(8, 14)}rem`,
  rotate: '1turn',
  duration: 1000,
  autoplay: false,
});

document.querySelector('[data-act="play"]').onclick = () => controlled.play();
document.querySelector('[data-act="pause"]').onclick = () => controlled.pause();
document.querySelector('[data-act="reverse"]').onclick = () => controlled.reverse();
document.querySelector('[data-act="seek"]').onclick = () => controlled.seek(400, true);
document.querySelector('[data-act="reset"]').onclick = () => controlled.reset();
document.querySelector('[data-act="revert"]').onclick = () => controlled.revert();
```

## Animation properties

Official page: <https://animejs.com/documentation/animation/animation-properties/>

The docs describe these properties as available on the object returned by `animate()` and `waapi.animate()`, with JS-only entries marked separately.

| Property | Type | Notes |
| --- | --- | --- |
| `id` | `String | Number` | JS-only. Read/write animation identifier. |
| `targets` | `Array` | Current animation targets. |
| `currentTime` | `Number` | Read/write global current time in milliseconds. |
| `iterationCurrentTime` | `Number` | JS-only. Read/write current time inside the current iteration. |
| `deltaTime` | `Number` | JS-only. Milliseconds elapsed since the previous frame. |
| `progress` | `Number` | Read/write overall progress in the range `0..1`. |
| `iterationProgress` | `Number` | JS-only. Read/write current iteration progress in the range `0..1`. |
| `currentIteration` | `Number` | JS-only. Read/write iteration counter. |
| `duration` | `Number` | Total duration in milliseconds. |
| `speed` | `Number` | Read/write playback speed multiplier. |
| `fps` | `Number` | JS-only. Read/write frame rate. |
| `paused` | `Boolean` | Read/write paused state. |
| `began` | `Boolean` | JS-only. Read/write started flag. |
| `completed` | `Boolean` | Read/write completion flag. |
| `reversed` | `Boolean` | JS-only. Read/write reverse flag. |
| `backwards` | `Boolean` | JS-only. Read-only indicator for whether playback is currently moving backward. |

Fresh example:

```html
<div class="property-readout-demo">
  <div class="meter"></div>
  <pre class="stats"></pre>
</div>
```

```css
.meter {
  width: 32px;
  height: 32px;
  background: #f59e0b;
}
```

```js
import { animate } from 'animejs';

const stats = document.querySelector('.stats');

const instance = animate('.meter', {
  x: '12rem',
  duration: 900,
  loop: true,
  alternate: true,
  onUpdate: self => {
    stats.textContent = JSON.stringify({
      currentTime: Math.round(self.currentTime),
      progress: Number(self.progress.toFixed(3)),
      currentIteration: self.currentIteration,
      paused: self.paused,
      completed: self.completed,
      backwards: self.backwards,
    }, null, 2);
  },
});
```

## Practical takeaways

- Reach for `animate()` when you need the full JS feature set, especially object targets, modifiers, refresh, custom callbacks, or JS-only methods.
- Reach for `waapi.animate()` when you want the lighter runtime and your animation fits within the WAAPI-compatible surface.
- Prefer transforms and opacity when animating DOM elements.
- Use local tween parameter objects when only one property needs different timing or easing.
- Use `playbackEase` when you want to reshape the whole animation arc rather than each tween segment.
- Use `refresh()` when function-based values or cached CSS variable values need to be recalculated.
- Use `revert()` when you want to fully tear an animation down and restore original values.
