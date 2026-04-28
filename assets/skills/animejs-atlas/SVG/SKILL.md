---
name: animejs-svg
description: Anime.js SVG reference covering morphTo(), createDrawable(), and createMotionPath(). Use when animating SVG path morphs, stroke drawing, or motion-path based transforms.
---

# Anime.js SVG Docs Companion

Official page: <https://animejs.com/documentation/svg/>

Use this companion when the task is about Anime.js SVG morphing, stroke drawing, or path-following motion. It rewrites the official SVG docs into atlas form, keeps the scope section-complete, and points back to the canonical docs for each helper page.

## Official reference

- SVG index: <https://animejs.com/documentation/svg/>
- `morphTo()`: <https://animejs.com/documentation/svg/morphto/>
- `createDrawable()`: <https://animejs.com/documentation/svg/createdrawable/>
- `createMotionPath()`: <https://animejs.com/documentation/svg/createmotionpath/>

## Official subsection map

The SVG index page is short. It introduces the SVG helper module and links to three helper pages:

- `morphTo()`: <https://animejs.com/documentation/svg/morphto/>
- `createDrawable()`: <https://animejs.com/documentation/svg/createdrawable/>
- `createMotionPath()`: <https://animejs.com/documentation/svg/createmotionpath/>

Each helper page contains the same documented subsections:

| Helper | Parameters | Returns | Code example |
| --- | --- | --- | --- |
| `morphTo()` | <https://animejs.com/documentation/svg/morphto/#parameters> | <https://animejs.com/documentation/svg/morphto/#returns> | <https://animejs.com/documentation/svg/morphto/#morphto-code-example> |
| `createDrawable()` | <https://animejs.com/documentation/svg/createdrawable/#parameters> | <https://animejs.com/documentation/svg/createdrawable/#returns> | <https://animejs.com/documentation/svg/createdrawable/#createdrawable-code-example> |
| `createMotionPath()` | <https://animejs.com/documentation/svg/createmotionpath/#parameters> | <https://animejs.com/documentation/svg/createmotionpath/#returns> | <https://animejs.com/documentation/svg/createmotionpath/#createmotionpath-code-example> |

## Page overview

The official SVG page describes this part of Anime.js as a utility set for:

- morphing one SVG shape into another
- revealing a stroke progressively as if it is being drawn
- mapping motion and rotation to an SVG path

Everything on the page routes into the same three helpers, so the practical surface area is:

- imports from the main module
- direct named imports from the main module
- the `animejs/svg` subpath
- `morphTo()`
- `createDrawable()`
- `createMotionPath()`

## Imports

The index page shows three official import styles.

Import the grouped SVG helper object from the main module:

```js
import { svg } from 'animejs';

svg.morphTo();
svg.createDrawable();
svg.createMotionPath();
```

Import the helpers directly from the main module:

```js
import { morphTo, createDrawable, createMotionPath } from 'animejs';
```

Import the helpers from the dedicated SVG subpath:

```js
import { morphTo, createDrawable, createMotionPath } from 'animejs/svg';
```

Practical rule:

- use `svg.*` when you want the SVG helpers grouped under one namespace
- use named imports when you want shorter call sites
- use `animejs/svg` when you want the SVG module boundary to be explicit

## `morphTo()`

Official page: <https://animejs.com/documentation/svg/morphto/>

The docs describe `morphTo()` as a helper that prepares values for shape morphing. You use it while animating:

- the `d` attribute of an `SVGPathElement`
- the `points` attribute of an `SVGPolylineElement`
- the `points` attribute of an `SVGPolygonElement`

### Signature

```js
svg.morphTo(shapeTarget, precision);
```

### Parameters

| Name | Accepts | Default | Notes |
| --- | --- | --- | --- |
| `shapeTarget` | CSS selector, `SVGPathElement`, `SVGPolylineElement`, `SVGPolygonElement` | none | This is the shape Anime.js reads as the morph destination. |
| `precision` | Number from `0` to `1` | `.33` | Controls how many extra points Anime.js generates for the morph. |

Official behavior to remember:

- `precision` is optional
- setting `precision` to `0` disables point extrapolation

### Returns

| Returns | Shape |
| --- | --- |
| `Array` | Two string values: the start shape value and the end shape value |

### How to think about it

`morphTo()` does not animate by itself. It gives you the start/end values that `animate()` can use for `d` or `points`.

Common patterns:

- `d: svg.morphTo('#target-path')`
- `points: svg.morphTo(targetPolygon)`

### Fresh example

```html
<section class="morph-demo">
  <svg viewBox="0 0 140 140" width="220" height="220" aria-label="Morphing polygon demo">
    <polygon
      id="morph-source"
      points="70,12 92,48 128,70 92,92 70,128 48,92 12,70 48,48"
    ></polygon>
    <polygon
      id="morph-target"
      points="70,18 106,42 118,86 82,118 36,108 20,62 40,24"
    ></polygon>
  </svg>
  <button type="button" class="morph-button">Remix target</button>
</section>
```

```css
.morph-demo {
  display: grid;
  gap: 1rem;
  justify-items: center;
}

.morph-demo svg {
  color: #0f172a;
}

#morph-source,
#morph-target {
  fill: color-mix(in srgb, #f59e0b 18%, white);
  stroke: currentColor;
  stroke-width: 3;
  stroke-linejoin: round;
}

#morph-target {
  opacity: 0;
}

.morph-button {
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: white;
}
```

```js
import { animate, svg, utils } from 'animejs';

const [source, target] = utils.$('polygon');
const button = document.querySelector('.morph-button');

function buildPoints() {
  const corners = utils.random(5, 10);
  let points = '';

  for (let i = 0; i < corners; i += 1) {
    const angle = (Math.PI * 2 * i) / corners - Math.PI / 2;
    const radius = i % 2 ? utils.random(24, 38) : utils.random(42, 58);
    const x = 70 + utils.round(Math.cos(angle) * radius, 0);
    const y = 70 + utils.round(Math.sin(angle) * radius, 0);
    points += `${x},${y} `;
  }

  return points.trim();
}

function morphOnce() {
  utils.set(target, { points: buildPoints() });

  animate(source, {
    points: svg.morphTo(target, 0.4),
    duration: 650,
    ease: 'inOutCirc',
  });
}

button.addEventListener('click', morphOnce);
```

### Working notes

- Reach for a small `precision` when you want a lighter morph.
- Raise `precision` when the source and target shapes need more interpolation support.
- Use `0` only when you explicitly want no extra point generation.

## `createDrawable()`

Official page: <https://animejs.com/documentation/svg/createdrawable/>

The docs describe `createDrawable()` as a helper that wraps supported SVG elements in proxy objects and adds a `draw` property. That `draw` property defines which visible slice of the stroke is currently shown.

### Signature

```js
const drawables = svg.createDrawable(target);
```

### Parameters

| Name | Accepts | Notes |
| --- | --- | --- |
| `target` | CSS selector, `SVGLineElement`, `SVGPathElement`, `SVGPolylineElement`, `SVGRectElement` | The helper returns one proxy per matched or supplied SVG element. |

### Returns

| Returns | Shape |
| --- | --- |
| `Array` | An array of proxy `SVGElement` values with an added `draw` property |

### `draw` value model

The official page describes `draw` as a string containing `start` and `end` values separated by a space.

| `draw` value | Meaning |
| --- | --- |
| `'0 1'` | Show the full stroke |
| `'0 .5'` | Show the first half |
| `'.25 .75'` | Show the middle section |
| `'.5 1'` | Show the last half |
| `'1 1'` | Collapse the visible segment to the end point |

### Performance note

The docs call out one specific caveat: animating an element that uses `vector-effect: non-scaling-stroke` can be slower, because Anime.js has to keep recalculating the path scale while the SVG size changes.

### Fresh example

```html
<section class="draw-demo">
  <svg viewBox="0 0 240 100" width="320" height="140" aria-label="Stroke drawing demo">
    <path class="trail" d="M20 76 C48 18, 102 18, 120 50 S192 82, 220 24"></path>
    <polyline class="trail" points="28,82 62,82 82,58 112,58 136,34 162,34 198,18"></polyline>
    <rect class="trail" x="156" y="44" width="46" height="32" rx="8"></rect>
  </svg>
</section>
```

```css
.draw-demo {
  display: grid;
  place-items: center;
}

.draw-demo svg {
  overflow: visible;
}

.trail {
  fill: none;
  stroke: #0f172a;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
```

```js
import { animate, svg, stagger } from 'animejs';

const drawableTargets = svg.createDrawable('.trail');

animate(drawableTargets, {
  draw: ['0 0', '0 1', '1 1'],
  duration: 1800,
  ease: 'inOutQuad',
  delay: stagger(140),
  loop: true,
});
```

### Working notes

- Use `createDrawable()` before calling `animate()` if you want to drive stroke reveal with the `draw` property.
- Expect an array back, even when the selector matches one element.
- The helper is best suited to line-like SVG artwork where stroke visibility matters more than fill changes.

## `createMotionPath()`

Official page: <https://animejs.com/documentation/svg/createmotionpath/>

The docs describe `createMotionPath()` as a helper that builds tween parameter objects from an SVG path. Those tween parameters map motion to the path's coordinates and inclination.

### Signature

```js
const { translateX, translateY, rotate } = svg.createMotionPath(path, offset);
```

### Parameters

| Name | Accepts | Default | Notes |
| --- | --- | --- | --- |
| `path` | CSS selector, `SVGPathElement` | none | The SVG path to sample for motion. |
| `offset` | Number from `0` to `1` | `0` | Lets you start from a different normalized position on the path. |

### Returns

| Property | Type | Meaning |
| --- | --- | --- |
| `translateX` | Tween parameter | Maps to the path's x coordinate |
| `translateY` | Tween parameter | Maps to the path's y coordinate |
| `rotate` | Tween parameter | Maps to the path's angle |

### How to think about it

This helper is meant to be spread into an animation config:

```js
animate('.thing', {
  ...svg.createMotionPath('path'),
});
```

That means:

- the path provides position data
- `rotate` follows the path direction automatically
- your animation still controls timing, easing, looping, and any extra properties

### Fresh example

```html
<section class="motion-demo">
  <div class="motion-stage">
    <svg viewBox="0 0 320 160" width="360" height="180" aria-label="Motion path demo">
      <path
        class="route"
        d="M20 112 C48 34, 120 18, 170 66 S262 142, 300 50"
      ></path>
    </svg>
    <div class="marker" aria-hidden="true"></div>
  </div>
</section>
```

```css
.motion-stage {
  position: relative;
  width: 360px;
  max-width: 100%;
  margin-inline: auto;
}

.route {
  fill: none;
  stroke: #1e293b;
  stroke-width: 3;
}

.marker {
  position: absolute;
  left: -10px;
  top: -10px;
  width: 20px;
  height: 20px;
  border-radius: 999px 999px 999px 0;
  background: linear-gradient(135deg, #22c55e, #15803d);
  box-shadow: 0 8px 24px rgb(21 128 61 / 0.28);
  transform-origin: 50% 50%;
}
```

```js
import { animate, svg } from 'animejs';

animate('.marker', {
  ease: 'linear',
  duration: 3200,
  loop: true,
  ...svg.createMotionPath('.route', 0.08),
});

animate(svg.createDrawable('.route'), {
  draw: ['0 0', '0 1'],
  ease: 'linear',
  duration: 3200,
  loop: true,
});
```

### Working notes

- Use `offset` when the moving element should not start exactly at the first path point.
- Pair `createMotionPath()` with `createDrawable()` when you want the route itself to reveal over the same timing window.
- Keep `ease: 'linear'` unless you want non-uniform travel speed along the path.

## Quick decisions

- "I need one SVG shape to become another." -> use `morphTo()`
- "I need a line-reveal or signature-drawing effect." -> use `createDrawable()`
- "I need an element to follow an SVG path and rotate with it." -> use `createMotionPath()`

## Next skill to load

- property animation rules and playback settings: [../animation/SKILL.md](../animation/SKILL.md)
- easing selection: [../easings/SKILL.md](../easings/SKILL.md)
- utility helpers like `utils.$()`, `utils.set()`, `stagger()`, and `random()`: [../utilities/SKILL.md](../utilities/SKILL.md)
