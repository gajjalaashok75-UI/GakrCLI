---
name: animejs-easings
description: Anime.js easing reference covering built-in eases, cubic Bezier, linear, steps, irregular, and spring easing. Use when choosing or tuning the motion feel of Anime.js animations or WAAPI-driven playback.
---

# Anime.js Easings Docs Companion

Official page: <https://animejs.com/documentation/easings/>

This file is a section-complete, paraphrased companion to the official Anime.js Easings docs and its linked easing pages. It covers:

- Easings overview
- Built-in eases
- Cubic Bezier easing
- Linear easing
- Steps easing
- Irregular easing
- Spring easing, including perceived parameters, physics parameters, and perceived `onComplete`

Use this as a working map of the official docs, not a replacement for them.

## Official section map

Fragment links below follow the current heading structure used by the Anime.js docs site.

### Easings overview

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/> |
| Easings code example | <https://animejs.com/documentation/easings/#easings-code-example> |

### Built-in eases

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/built-in-eases/> |
| List of built-in easing functions | <https://animejs.com/documentation/easings/built-in-eases/#list-of-built-in-easing-functions> |
| Built-in eases code example | <https://animejs.com/documentation/easings/built-in-eases/#built-in-eases-code-example> |

### Cubic Bezier easing

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/cubic-bezier-easing/> |
| For JavaScript | <https://animejs.com/documentation/easings/cubic-bezier-easing/#for-javascript> |
| For WAAPI | <https://animejs.com/documentation/easings/cubic-bezier-easing/#for-waapi> |
| Parameters | <https://animejs.com/documentation/easings/cubic-bezier-easing/#parameters> |
| Examples | <https://animejs.com/documentation/easings/cubic-bezier-easing/#examples> |
| Code example | <https://animejs.com/documentation/easings/cubic-bezier-easing/#cubic-bezier-easing-code-example> |

### Linear easing

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/linear-easing/> |
| For JavaScript | <https://animejs.com/documentation/easings/linear-easing/#for-javascript> |
| For WAAPI | <https://animejs.com/documentation/easings/linear-easing/#for-waapi> |
| Parameters | <https://animejs.com/documentation/easings/linear-easing/#parameters> |
| Code example | <https://animejs.com/documentation/easings/linear-easing/#linear-easing-code-example> |

### Steps easing

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/steps-easing/> |
| For JavaScript | <https://animejs.com/documentation/easings/steps-easing/#for-javascript> |
| For WAAPI | <https://animejs.com/documentation/easings/steps-easing/#for-waapi> |
| Parameters | <https://animejs.com/documentation/easings/steps-easing/#parameters> |
| Examples | <https://animejs.com/documentation/easings/steps-easing/#examples> |
| Code example | <https://animejs.com/documentation/easings/steps-easing/#steps-easing-code-example> |

### Irregular easing

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/irregular-easing/> |
| Parameters | <https://animejs.com/documentation/easings/irregular-easing/#parameters> |
| Examples | <https://animejs.com/documentation/easings/irregular-easing/#examples> |
| Code example | <https://animejs.com/documentation/easings/irregular-easing/#irregular-easing-code-example> |

### Spring

| Section | Official link |
| --- | --- |
| Page | <https://animejs.com/documentation/easings/spring/> |
| Perceived parameters | <https://animejs.com/documentation/easings/spring/#perceived-parameters> |
| Physics parameters | <https://animejs.com/documentation/easings/spring/#physics-parameters> |
| Perceived `onComplete` callback | <https://animejs.com/documentation/easings/spring/#perceived-oncomplete-callback> |
| Examples | <https://animejs.com/documentation/easings/spring/#examples> |
| Code example | <https://animejs.com/documentation/easings/spring/#spring-code-example> |

## Imports and shared usage

Official references:

- Overview: <https://animejs.com/documentation/easings/>
- Built-in eases: <https://animejs.com/documentation/easings/built-in-eases/>
- Cubic Bezier easing: <https://animejs.com/documentation/easings/cubic-bezier-easing/>
- Linear easing: <https://animejs.com/documentation/easings/linear-easing/>
- Steps easing: <https://animejs.com/documentation/easings/steps-easing/>
- Irregular easing: <https://animejs.com/documentation/easings/irregular-easing/>
- Spring: <https://animejs.com/documentation/easings/spring/>

Main module imports gathered across the official pages:

```js
import {
  animate,
  waapi,
  easings,
  eases,
  cubicBezier,
  linear,
  steps,
  irregular,
  spring,
  stagger,
} from 'animejs';
```

Easings subpath imports shown by the overview and applicable to easing helpers:

```js
import {
  eases,
  cubicBezier,
  linear,
  steps,
  irregular,
  spring,
} from 'animejs/easings';
```

Where these values are used:

- `ease` on `animate()`
- `ease` on `waapi.animate()`
- `playbackEase` on `animate()`
- `ease` inside `stagger()`

Return notes:

- The overview and detail pages show these helpers being passed into `ease`, so the return descriptions below are inferred from official usage when the docs do not name the return type directly.
- `spring()` is the one page that explicitly says it returns an easing function together with a matching duration.

## API quick map

| API | Imports | Parameters | Returns |
| --- | --- | --- | --- |
| Built-in ease strings | none beyond `animate` or `waapi` | A string like `'outQuad'` or `'outElastic(.8, 1.2)'` | Not applicable; you pass the string directly |
| `eases` object | `eases` | Variant-specific, such as `eases.inOut(3)` or `eases.outElastic(.8, 1.2)` | Built-in easing function or configured easing generator result |
| `cubicBezier()` | `cubicBezier` | `x1, y1, x2, y2` | Custom easing function |
| `linear()` | `linear` | `stop1, stop2, ...stopN` | Custom easing function for JS usage |
| `steps()` | `steps` | `n, fromStart?` | Step easing function for JS usage |
| `irregular()` | `irregular` | `steps, randomness?` | Irregular easing function |
| `spring()` | `spring` | One options object | Easing function with a computed duration |

## Easings overview

Official page: <https://animejs.com/documentation/easings/>

Anime.js groups classic timing curves and a spring generator under one easing toolkit. The overview page shows three access styles:

- `easings` namespace from `'animejs'`
- Direct named imports from `'animejs'`
- Direct named imports from `'animejs/easings'`

The page also notes that easing values can drive normal tween timing with `ease`, whole-animation reshaping with `playbackEase`, and stagger distribution with `stagger({ ease })`.

Fresh example:

```html
<section class="easing-overview-demo">
  <div class="lane">
    <div class="dot dot-a"></div>
    <span class="label">built-in</span>
  </div>
  <div class="lane">
    <div class="dot dot-b"></div>
    <span class="label">cubicBezier()</span>
  </div>
  <div class="lane">
    <div class="dot dot-c"></div>
    <span class="label">spring()</span>
  </div>
</section>
```

```css
.easing-overview-demo {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
}

.lane {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
}

.dot {
  width: 22px;
  height: 22px;
  border-radius: 999px;
}

.dot-a { background: #ea580c; }
.dot-b { background: #0284c7; }
.dot-c { background: #16a34a; }

.label {
  font: 600 0.9rem/1.2 Georgia, serif;
  color: #7c2d12;
}
```

```js
import { animate, waapi, cubicBezier, spring } from 'animejs';

animate('.dot-a', {
  x: '16rem',
  ease: 'out(3)',
});

animate('.dot-b', {
  x: '16rem',
  ease: cubicBezier(0.18, 0.72, 0.28, 1),
});

waapi.animate('.dot-c', {
  x: '16rem',
  ease: spring({ bounce: 0.25 }),
});
```

## Built-in eases

Official page: <https://animejs.com/documentation/easings/built-in-eases/>

Built-in eases are the quickest option when you want readable motion presets without defining a custom curve. The official docs show two usage styles:

- pass a built-in name string directly to `ease`
- access the same easing family through the imported `eases` object

### Imports

```js
import { animate, waapi, eases } from 'animejs';
```

### Parameters and variants

| Family | Parameters | Variants |
| --- | --- | --- |
| Linear | none | `'linear'` |
| Power | `power = 1.675` | `'in'`, `'out'`, `'inOut'`, `'outIn'` |
| Quad | none | `'inQuad'`, `'outQuad'`, `'inOutQuad'`, `'outInQuad'` |
| Cubic | none | `'inCubic'`, `'outCubic'`, `'inOutCubic'`, `'outInCubic'` |
| Quart | none | `'inQuart'`, `'outQuart'`, `'inOutQuart'`, `'outInQuart'` |
| Quint | none | `'inQuint'`, `'outQuint'`, `'inOutQuint'`, `'outInQuint'` |
| Sine | none | `'inSine'`, `'outSine'`, `'inOutSine'`, `'outInSine'` |
| Exponential | none | `'inExpo'`, `'outExpo'`, `'inOutExpo'`, `'outInExpo'` |
| Circular | none | `'inCirc'`, `'outCirc'`, `'inOutCirc'`, `'outInCirc'` |
| Bounce | none | `'inBounce'`, `'outBounce'`, `'inOutBounce'`, `'outInBounce'` |
| Back | `overshoot = 1.70158` | `'inBack'`, `'outBack'`, `'inOutBack'`, `'outInBack'` |
| Elastic | `amplitude = 1`, `period = .3` | `'inElastic'`, `'outElastic'`, `'inOutElastic'`, `'outInElastic'` |

### Returns

- Direct string form: no return value; it is just the `ease` literal.
- `eases` object form: built-in easing function accessors, including configurable families such as `eases.inOut(3)` and `eases.outElastic(.8, 1.2)`.

### Code example coverage

The official code example demonstrates:

- a power ease string without an explicit exponent
- a power ease string with an explicit exponent
- a named preset in `waapi.animate()`

Fresh example:

```html
<div class="built-in-demo">
  <div class="track"><div class="card card-a"></div><span>outQuad</span></div>
  <div class="track"><div class="card card-b"></div><span>inOut(3)</span></div>
  <div class="track"><div class="card card-c"></div><span>outElastic(.7, .45)</span></div>
</div>
```

```css
.built-in-demo {
  display: grid;
  gap: 12px;
}

.track {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  background: #fffaf5;
}

.card {
  width: 34px;
  height: 34px;
  border-radius: 10px;
}

.card-a { background: #fb7185; }
.card-b { background: #f59e0b; }
.card-c { background: #8b5cf6; }
```

```js
import { animate, eases } from 'animejs';

animate('.card-a', {
  x: '15rem',
  ease: 'outQuad',
});

animate('.card-b', {
  x: '15rem',
  ease: 'inOut(3)',
});

animate('.card-c', {
  x: '15rem',
  ease: eases.outElastic(0.7, 0.45),
});
```

## Cubic Bezier easing

Official page: <https://animejs.com/documentation/easings/cubic-bezier-easing/>

A cubic Bezier easing uses two control points to describe a smooth custom curve. The page explicitly splits usage between JavaScript helper form and WAAPI string form.

### Imports

```js
import { animate, waapi, cubicBezier } from 'animejs';
```

### Parameters

| Name | Type | Notes |
| --- | --- | --- |
| `x1` | `Number` | First control point x. Must stay between `0` and `1`. |
| `y1` | `Number` | First control point y. Negative values create anticipation; values above `1` create overshoot. |
| `x2` | `Number` | Second control point x. Must stay between `0` and `1`. |
| `y2` | `Number` | Second control point y. Negative values create anticipation; values above `1` create overshoot. |

Signature:

```js
cubicBezier(x1, y1, x2, y2)
```

### Returns

- JS helper form: custom easing function.
- WAAPI form: use a CSS timing-function string such as `'cubic-bezier(...)'` or the Anime.js-friendly `'cubicBezier(...)'` alias shown by the docs.

### Official examples section

The page lists these preset example categories:

- In cubic bezier curve
- Out cubic bezier curve
- InOut cubic bezier curve
- OutIn cubic bezier curve

Fresh example:

```html
<div class="bezier-demo">
  <div class="bezier-row"><div class="pill pill-a"></div><span>anticipation</span></div>
  <div class="bezier-row"><div class="pill pill-b"></div><span>overshoot</span></div>
  <div class="bezier-row"><div class="pill pill-c"></div><span>waapi string</span></div>
</div>
```

```css
.bezier-demo {
  display: grid;
  gap: 12px;
}

.bezier-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.pill {
  width: 48px;
  height: 20px;
  border-radius: 999px;
}

.pill-a { background: #0f766e; }
.pill-b { background: #0369a1; }
.pill-c { background: #7c3aed; }
```

```js
import { animate, waapi, cubicBezier } from 'animejs';

animate('.pill-a', {
  x: '14rem',
  ease: cubicBezier(0.25, -0.2, 0.6, 0.95),
});

animate('.pill-b', {
  x: '14rem',
  ease: cubicBezier(0.2, 0.8, 0.2, 1.2),
});

waapi.animate('.pill-c', {
  x: '14rem',
  ease: 'cubicBezier(0.6, 0.05, 0.35, 1)',
});
```

## Linear easing

Official page: <https://animejs.com/documentation/easings/linear-easing/>

Linear easing in Anime.js is not limited to a flat constant-rate curve. This page uses the CSS linear timing-function model, where multiple stops let you create flat segments, jumps, or overshoot-like ramps.

### Imports

```js
import { animate, waapi, linear } from 'animejs';
```

### Parameters

Signature:

```js
linear(stop1, stop2, ...stopN)
```

| Name | Type | Notes |
| --- | --- | --- |
| `number` | `Number` | Output value at a stop. At least two values are required. `0` is the start and `1` is the end; values outside that range create overshoot. |
| `percentage` | `String` | Optional stop position, written like `'0.5 50%'`. It cannot be used for the first or last stop. When omitted, Anime.js distributes stops evenly. |

### Returns

- JS helper form: custom linear easing function.
- WAAPI form: native `'linear(...)'` timing-function string.

### Code example coverage

The official example shows:

- repeated values for flat segments
- a percentage stop in the JS helper form
- the equivalent WAAPI string form

Fresh example:

```html
<div class="linear-demo">
  <div class="bar-wrap"><div class="bar bar-a"></div><span>plateaus</span></div>
  <div class="bar-wrap"><div class="bar bar-b"></div><span>late surge</span></div>
  <div class="bar-wrap"><div class="bar bar-c"></div><span>waapi linear()</span></div>
</div>
```

```css
.linear-demo {
  display: grid;
  gap: 12px;
}

.bar-wrap {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
}

.bar {
  width: 42px;
  height: 18px;
  border-radius: 999px;
}

.bar-a { background: #22c55e; }
.bar-b { background: #14b8a6; }
.bar-c { background: #3b82f6; }
```

```js
import { animate, waapi, linear } from 'animejs';

animate('.bar-a', {
  x: '16rem',
  duration: 1800,
  ease: linear(0, 0, 0.45, 0.45, 1, 1),
});

animate('.bar-b', {
  x: '16rem',
  duration: 1800,
  ease: linear(0, '0.2 70%', 1),
});

waapi.animate('.bar-c', {
  x: '16rem',
  duration: 1800,
  ease: 'linear(0, 0.8 35%, 0.8 75%, 1)',
});
```

## Steps easing

Official page: <https://animejs.com/documentation/easings/steps-easing/>

Steps easing divides the animation into discrete jumps instead of a continuous curve. The docs describe the JS helper form and the native WAAPI string form separately.

### Imports

```js
import { animate, waapi, steps } from 'animejs';
```

### Parameters

Signature:

```js
steps(n, fromStart)
```

| Name | Type | Notes |
| --- | --- | --- |
| `steps` | `Number` | Number of equal jumps. Must be a positive integer. |
| `fromStart` | `Boolean` | Optional. `true` makes each jump happen at the beginning of the step. `false` leaves the jump at the end of the step. Default: `false`. |

### Returns

- JS helper form: stepped easing function.
- WAAPI form: native `'steps(...)'` string, including the `'start'` keyword shown by the docs.

### Official examples section

The page lists:

- Steps start easing
- Steps end easing

Fresh example:

```html
<div class="steps-demo">
  <div class="steps-row"><div class="token token-a"></div><span>end jumps</span></div>
  <div class="steps-row"><div class="token token-b"></div><span>start jumps</span></div>
  <div class="steps-row"><div class="token token-c"></div><span>waapi steps()</span></div>
</div>
```

```css
.steps-demo {
  display: grid;
  gap: 12px;
}

.steps-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 10px;
}

.token {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}

.token-a { background: #f97316; }
.token-b { background: #ef4444; }
.token-c { background: #0ea5e9; }
```

```js
import { animate, waapi, steps } from 'animejs';

animate('.token-a', {
  x: '15rem',
  ease: steps(5),
});

animate('.token-b', {
  x: '15rem',
  ease: steps(5, true),
});

waapi.animate('.token-c', {
  x: '15rem',
  ease: 'steps(7, start)',
});
```

## Irregular easing

Official page: <https://animejs.com/documentation/easings/irregular-easing/>

Irregular easing creates a path made from randomized linear segments. It is the most intentionally uneven easing page in this section and is useful when you want motion that feels jittery or hand-authored instead of smooth and symmetric.

### Imports

```js
import { animate, waapi, irregular } from 'animejs';
```

### Parameters

Signature:

```js
irregular(steps, randomness)
```

| Name | Type | Notes |
| --- | --- | --- |
| `steps` | `Number` | Number of random segments to generate. Must be a positive integer. |
| `randomness` | `Number` | Optional. Controls how dramatic the random variation becomes. Default: `1`. |

### Returns

- Inferred from official usage: an irregular easing function that can be passed directly to `animate()` and `waapi.animate()`.

### Official examples section

The page lists:

- Light irregular easing
- Heavy irregular easing

Fresh example:

```html
<div class="irregular-demo">
  <div class="irregular-row"><div class="spark spark-a"></div><span>low randomness</span></div>
  <div class="irregular-row"><div class="spark spark-b"></div><span>medium randomness</span></div>
  <div class="irregular-row"><div class="spark spark-c"></div><span>high randomness</span></div>
</div>
```

```css
.irregular-demo {
  display: grid;
  gap: 12px;
}

.irregular-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.spark {
  width: 20px;
  height: 20px;
  border-radius: 999px;
}

.spark-a { background: #84cc16; }
.spark-b { background: #f59e0b; }
.spark-c { background: #ec4899; }
```

```js
import { animate, waapi, irregular } from 'animejs';

animate('.spark-a', {
  x: '15rem',
  duration: 1800,
  ease: irregular(10, 0.35),
});

animate('.spark-b', {
  x: '15rem',
  duration: 1800,
  ease: irregular(10, 1),
});

waapi.animate('.spark-c', {
  x: '15rem',
  duration: 1800,
  ease: irregular(10, 1.8),
});
```

## Spring

Official page: <https://animejs.com/documentation/easings/spring/>

Spring easing is the physics-based option in the easings set. The spring page explicitly says the helper returns an easing function with a matching duration, and it also notes that the animation's normal `duration` is replaced by the spring's computed settling time.

### Imports

```js
import { animate, waapi, spring } from 'animejs';
```

### Signature

```js
spring(options)
```

### Returns

- Officially described return: an easing function with its corresponding duration.
- Practical effect: the spring decides the timeline length for the animation unless you are using perceived parameters with a perceived `duration`.

### Perceived parameters

These are the higher-level controls. The docs say Anime.js derives the underlying physics from Apple's SwiftUI spring model when you use this form.

| Name | Type | Range / default | Notes |
| --- | --- | --- | --- |
| `bounce` | `Number` | `-1` to `1`, default `0.5` | Positive values create visible bounce. Negative values move toward over-damped motion. The docs recommend staying roughly between `-.5` and `.5` for usable results. |
| `duration` | `Number` | `10` to `10000`, default `628` | Perceived completion time in milliseconds. This is when the motion feels done, not necessarily when the spring has fully settled numerically. |

### Physics parameters

Use these when you want the spring described directly in simulation terms.

| Name | Type | Range / default | Notes |
| --- | --- | --- | --- |
| `mass` | `Number` | `1` to `10000`, default `1` | Higher mass adds inertia and makes the movement feel heavier. |
| `stiffness` | `Number` | `0` to `10000`, default `100` | Higher stiffness makes the spring snap harder and faster. |
| `damping` | `Number` | `0` to `10000`, default `10` | Higher damping kills oscillation sooner. |
| `velocity` | `Number` | `-10000` to `10000`, default `0` | Sets the starting momentum. Positive values push motion forward from the start. |

### Perceived `onComplete` callback

This subsection only applies to the JS version of `animate()`.

The docs distinguish between:

- the animation-level `onComplete`, which tracks the spring's settling duration
- the spring option `onComplete`, which fires at the perceived `duration`

That distinction matters when the visible motion looks done before the simulation is technically fully settled.

| Name | Type | Notes |
| --- | --- | --- |
| `onComplete` | `Function` | Fires when the spring reaches perceived completion rather than full settling. |

### Official examples section

The page lists:

- Default spring
- Snappy spring
- Bouncy spring
- Strong spring

Fresh example:

```html
<div class="spring-demo">
  <div class="spring-row">
    <div class="badge badge-a"></div>
    <span>perceived bounce</span>
  </div>
  <div class="spring-row">
    <div class="badge badge-b"></div>
    <span>stronger bounce</span>
  </div>
  <div class="spring-row">
    <div class="badge badge-c"></div>
    <span>physics params</span>
  </div>
  <pre class="spring-log"></pre>
</div>
```

```css
.spring-demo {
  display: grid;
  gap: 12px;
}

.spring-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.badge {
  width: 30px;
  height: 30px;
  border-radius: 999px;
}

.badge-a { background: #22c55e; }
.badge-b { background: #eab308; }
.badge-c { background: #3b82f6; }

.spring-log {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  color: #0f172a;
  min-height: 56px;
}
```

```js
import { animate, spring } from 'animejs';

const log = document.querySelector('.spring-log');
const write = message => {
  log.textContent += `${message}\n`;
};

animate('.badge-a', {
  x: '15rem',
  onComplete: () => write('badge-a: settled'),
  ease: spring({
    bounce: 0.18,
    duration: 420,
    onComplete: () => write('badge-a: perceived complete'),
  }),
});

animate('.badge-b', {
  x: '15rem',
  onComplete: () => write('badge-b: settled'),
  ease: spring({
    bounce: 0.38,
    duration: 520,
    onComplete: () => write('badge-b: perceived complete'),
  }),
});

animate('.badge-c', {
  x: '15rem',
  ease: spring({
    stiffness: 140,
    damping: 11,
    velocity: 2,
  }),
});
```

## Practical takeaways

- Start with built-in eases when you want readable defaults and fast iteration.
- Use `cubicBezier()` when you need deliberate control over anticipation, overshoot, or a brand-specific motion signature.
- Use `linear()` when you need stop-based shaping rather than a classic curve family.
- Use `steps()` for counters, sprite-like motion, or intentionally discrete state changes.
- Use `irregular()` when the point is stylized unevenness rather than precision.
- Use `spring()` when motion should feel physical, especially for entrances, releases, and interactive state changes.
- Remember that spring timing is special: visible completion and true settling are not always the same moment.
