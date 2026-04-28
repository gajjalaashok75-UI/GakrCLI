---
name: animejs-waapi
description: Anime.js Web Animation API reference covering waapi.animate(), when to use WAAPI, hardware acceleration, Anime.js improvements over native WAAPI, API differences, and convertEase(). Use when comparing or implementing Anime.js WAAPI playback.
---

# Anime.js WAAPI Docs Companion

Official page: <https://animejs.com/documentation/web-animation-api/>

This file is a section-complete, paraphrased companion to the official Anime.js Web Animation API docs page and its linked WAAPI subsections. It covers:

- `waapi.animate()`
- when to use WAAPI
- hardware-acceleration guidance
- every subsection under improvements to WAAPI
- every subsection under API differences with native WAAPI
- `waapi.convertEase()`

Use this as a practical field guide, not a replacement for the official docs.

## Imports, signature, parameters, returns

Official references:

- Main WAAPI page: <https://animejs.com/documentation/web-animation-api/>
- Improvements overview: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/>
- API differences overview: <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/>
- `waapi.convertEase()`: <https://animejs.com/documentation/web-animation-api/waapi-convertease/>

Primary imports:

```js
import { waapi } from 'animejs';
import { waapi as waapiOnly } from 'animejs/waapi';
import { animate, stagger, splitText, utils, eases, spring, onScroll, createScope } from 'animejs';
```

Core signature:

```js
const animation = waapi.animate(targets, parameters);
```

Official parameter contract:

| Name | Accepts |
| --- | --- |
| `targets` | The same target families documented in the official Animation Targets docs: <https://animejs.com/documentation/animation/targets/> |
| `parameters` | An object that mixes animatable properties, tween parameters, playback settings, and animation callbacks |

Official return:

- `waapi.animate()` returns `WAAPIAnimation`

## Official section map

### Top-level pages

| Section | Direct link |
| --- | --- |
| Web Animation API | <https://animejs.com/documentation/web-animation-api/> |
| When to use WAAPI | <https://animejs.com/documentation/web-animation-api/when-to-use-waapi/> |
| Hardware-accelerated animations | <https://animejs.com/documentation/web-animation-api/hardware-accelerated-animations/> |
| Improvements to the Web Animation API | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/> |
| API differences with native WAAPI | <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/> |
| `waapi.convertEase()` | <https://animejs.com/documentation/web-animation-api/waapi-convertease/> |

### Improvements to WAAPI subsections

| Subsection | Direct link |
| --- | --- |
| Sensible defaults | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/sensible-defaults/> |
| Multi-targets animation | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/multi-targets-animation/> |
| Default units | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/default-units/> |
| Function based values | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/function-based-values/> |
| Individual CSS transforms | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/individual-css-transforms/> |
| Individual property parameters | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/individual-property-parameters/> |
| Spring and custom easings | <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/spring-and-custom-easings/> |

### API differences subsections

| Subsection | Direct link |
| --- | --- |
| `iterations` | <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/iterations/> |
| `direction` | <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/direction/> |
| `easing` | <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/easing/> |
| `finished` | <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/finished/> |

## Quick start example

Fresh example:

```html
<section class="waapi-hero">
  <h2 class="waapi-title">
    <span>W</span><span>A</span><span>A</span><span>P</span><span>I</span>
  </h2>
</section>
```

```css
.waapi-hero {
  min-height: 180px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #10213a, #214f6b);
  color: #f8fafc;
}

.waapi-title {
  display: flex;
  gap: 0.16em;
  margin: 0;
  font: 700 2.4rem/1.05 Georgia, serif;
  letter-spacing: 0.06em;
}

.waapi-title span {
  display: inline-block;
}
```

```js
import { waapi, splitText, stagger } from 'animejs';

const { chars } = splitText('.waapi-title', { words: false, chars: true });

waapi.animate(chars, {
  translate: ['0 0', '0 -1.5rem'],
  opacity: [0.35, 1],
  delay: stagger(80),
  duration: 700,
  alternate: true,
  loop: true,
  ease: 'inOut(3)',
});
```

## When to use WAAPI

Official page: <https://animejs.com/documentation/web-animation-api/when-to-use-waapi/>

The official docs position WAAPI and the JavaScript `animate()` engine as complementary tools. Reach for `waapi.animate()` when browser-native playback is the better fit, not because it automatically wins every animation problem.

Prioritize `waapi.animate()` when:

- the page may be under CPU or network pressure
- startup cost matters and the lighter WAAPI bundle is attractive
- you need CSS value handling that the JS engine may not parse as well, such as transform matrices or CSS color functions

Prefer `animate()` when:

- you are animating very large target sets, especially beyond a few hundred elements
- you need JS-only targets such as objects, canvas, WebGL, or WebGPU data
- you need SVG attributes, HTML attributes, or CSS properties outside WAAPI's reach
- the animation depends on more advanced timelines, callbacks, or control methods

Fresh example:

```html
<div class="choice-demo">
  <div class="card waapi-card">DOM via WAAPI</div>
  <pre class="log-card">{"progress":0,"angle":0}</pre>
</div>
```

```css
.choice-demo {
  display: grid;
  gap: 14px;
}

.waapi-card,
.log-card {
  width: fit-content;
  min-width: 180px;
  padding: 12px 16px;
  border-radius: 14px;
  background: #e2e8f0;
}

.waapi-card {
  color: #0f172a;
}
```

```js
import { animate, waapi } from 'animejs';

waapi.animate('.waapi-card', {
  x: '12rem',
  rotate: '1turn',
  loop: 2,
  alternate: true,
});

const state = { progress: 0, angle: 0 };
animate(state, {
  progress: 100,
  angle: 360,
  duration: 1400,
  onRender: () => {
    document.querySelector('.log-card').textContent = JSON.stringify(state);
  },
});
```

## Hardware-accelerated animations

Official page: <https://animejs.com/documentation/web-animation-api/hardware-accelerated-animations/>

The official docs call out a major WAAPI advantage: some animations can keep running off the main thread, which helps motion stay smoother when the CPU is busy and can reduce power use.

Properties that the docs list as hardware-accelerated across major browsers:

- `opacity`
- `transform`
- `translate`
- `scale`
- `rotate`

Properties the docs say are hardware-accelerated only in some browsers:

- `clip-path`
- `filter`

Important caveat from the official page:

- Safari on desktop and mobile does not currently hardware-accelerate these animations when they use a custom `linear()` easing
- that includes converted power eases such as `'out(3)'`, `'in(3)'`, `'inOut(3)'`
- it also includes JavaScript easing functions passed through `waapi.animate()`

Fresh example:

```html
<div class="perf-demo">
  <button class="stress-toggle">Toggle CPU stress</button>
  <div class="lane">
    <div class="pill waapi-pill">WAAPI</div>
    <div class="pill js-pill">JS</div>
  </div>
</div>
```

```css
.perf-demo {
  display: grid;
  gap: 14px;
}

.lane {
  display: grid;
  gap: 10px;
}

.pill {
  width: 92px;
  padding: 10px 14px;
  border-radius: 999px;
  color: #fff;
}

.waapi-pill {
  background: #0f766e;
}

.js-pill {
  background: #b45309;
}
```

```js
import { animate, waapi } from 'animejs';

waapi.animate('.waapi-pill', {
  translate: '16rem',
  rotate: '1turn',
  alternate: true,
  loop: true,
  ease: 'cubic-bezier(0, 0, .58, 1)',
});

animate('.js-pill', {
  x: '16rem',
  rotate: '1turn',
  alternate: true,
  loop: true,
  ease: 'outQuad',
});

let stressing = false;
document.querySelector('.stress-toggle').onclick = () => {
  stressing = !stressing;
  if (!stressing) return;
  const end = performance.now() + 1200;
  while (performance.now() < end) {
    Math.sqrt(Math.random() * 1000);
  }
};
```

## Improvements to WAAPI

Official overview: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/>

Anime.js wraps native WAAPI with a more ergonomic surface. The overview page also highlights that WAAPI animations can plug into Anime.js features such as `onScroll()` and `createScope()`.

Fresh integration example:

```js
import { waapi, onScroll, createScope } from 'animejs';

createScope({
  mediaQueries: {
    reduceMotion: '(prefers-reduced-motion)',
  },
}).add(({ matches }) => {
  waapi.animate('.scroller', {
    transform: matches.reduceMotion ? ['8rem', '8rem'] : '8rem',
    opacity: [0.2, 1],
    autoplay: onScroll(),
  });
});
```

### Sensible defaults

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/sensible-defaults/>

Raw `Element.animate()` expects you to provide more setup yourself. Anime.js smooths that out by giving WAAPI animations a ready-to-use duration and easing baseline and by preserving the final visual state after completion.

What the docs emphasize:

- native WAAPI needs an explicit duration
- native WAAPI has no easing by default
- native WAAPI does not keep the final value unless you handle it
- `waapi.animate()` aligns its default duration and delay behavior with the JS `animate()` API

Fresh example:

```html
<div class="defaults-demo">
  <div class="dot defaults-dot"></div>
</div>
```

```css
.defaults-dot {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  background: #7c3aed;
}
```

```js
import { waapi } from 'animejs';

waapi.animate('.defaults-dot', {
  translate: '14rem',
});
```

### Multi-targets animation

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/multi-targets-animation/>

This subsection focuses on selector-driven multi-element animation in one call.

Official accepts:

| Name | Accepts |
| --- | --- |
| `targets` in this subsection | Any `String` accepted by `document.querySelectorAll()` |

Why it matters:

- you can animate many matching DOM nodes with one `waapi.animate()` call
- `stagger()` works naturally with that selector-based target set

Fresh example:

```html
<div class="stack-demo">
  <div class="stack-chip"></div>
  <div class="stack-chip"></div>
  <div class="stack-chip"></div>
  <div class="stack-chip"></div>
</div>
```

```css
.stack-demo {
  display: grid;
  gap: 8px;
}

.stack-chip {
  width: 56px;
  height: 18px;
  border-radius: 999px;
  background: #2563eb;
}
```

```js
import { waapi, stagger } from 'animejs';

waapi.animate('.stack-chip', {
  translate: '12rem',
  delay: stagger(90),
  loop: true,
  alternate: true,
});
```

### Default units

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/default-units/>

If you pass a bare number for a property that usually needs a unit, Anime.js can attach a default unit for the supported WAAPI-friendly property set below.

Official default-unit map:

| Property | Default unit |
| --- | --- |
| `x` | `px` |
| `y` | `px` |
| `z` | `px` |
| `translateX` | `px` |
| `translateY` | `px` |
| `translateZ` | `px` |
| `rotate` | `deg` |
| `rotateX` | `deg` |
| `rotateY` | `deg` |
| `rotateZ` | `deg` |
| `skew` | `deg` |
| `skewX` | `deg` |
| `skewY` | `deg` |
| `perspective` | `px` |
| `width` | `px` |
| `height` | `px` |
| `margin` | `px` |
| `padding` | `px` |
| `top` | `px` |
| `right` | `px` |
| `bottom` | `px` |
| `left` | `px` |
| `borderWidth` | `px` |
| `fontSize` | `px` |
| `borderRadius` | `px` |

Fresh example:

```html
<div class="units-demo">
  <div class="units-box"></div>
</div>
```

```css
.units-box {
  width: 32px;
  height: 32px;
  background: #dc2626;
}
```

```js
import { waapi } from 'animejs';

waapi.animate('.units-box', {
  x: 180,
  rotate: 35,
  width: 72,
  height: 48,
  borderRadius: 18,
});
```

### Function based values

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/function-based-values/>

This adds per-target function values on top of WAAPI, so a single animation call can compute different outputs for each matched element.

The docs show functions being used for:

- transform values
- scale and rotation
- playback values such as `duration`
- stagger-friendly delays

Fresh example:

```html
<div class="fn-demo">
  <div class="fn-cell" data-ms="450"></div>
  <div class="fn-cell" data-ms="650"></div>
  <div class="fn-cell" data-ms="850"></div>
  <div class="fn-cell" data-ms="1050"></div>
</div>
```

```css
.fn-demo {
  display: grid;
  gap: 10px;
}

.fn-cell {
  width: 40px;
  height: 40px;
  background: #059669;
}
```

```js
import { waapi, utils, stagger } from 'animejs';

waapi.animate('.fn-cell', {
  translate: () => `${utils.random(6, 14)}rem`,
  rotate: () => utils.random(-120, 120),
  scale: (_, i) => 0.7 + (i * 0.12),
  duration: el => Number(el.dataset.ms),
  delay: stagger(70),
});
```

### Individual CSS transforms

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/individual-css-transforms/>

Anime.js lets you address transform parts separately instead of authoring a single transform string.

Important constraints from the docs:

- this relies on browser support for registered CSS properties
- unsupported browsers fall back to no animation for these properties
- these individual transform properties are not hardware-accelerated

Official individual transform properties:

| Property | Shorthand | Default value | Default unit |
| --- | --- | --- | --- |
| `translateX` | `x` | `0px` | `px` |
| `translateY` | `y` | `0px` | `px` |
| `translateZ` | `z` | `0px` | `px` |
| `rotate` | none | `0deg` | `deg` |
| `rotateX` | none | `0deg` | `deg` |
| `rotateY` | none | `0deg` | `deg` |
| `rotateZ` | none | `0deg` | `deg` |
| `scale` | none | `1` | unitless |
| `scaleX` | none | `1` | unitless |
| `scaleY` | none | `1` | unitless |
| `scaleZ` | none | `1` | unitless |
| `skew` | none | `0deg` | `deg` |
| `skewX` | none | `0deg` | `deg` |
| `skewY` | none | `0deg` | `deg` |

Fresh example:

```html
<div class="transform-demo">
  <div class="transform-box"></div>
  <div class="transform-box"></div>
  <div class="transform-box"></div>
</div>
```

```css
.transform-demo {
  display: grid;
  gap: 12px;
}

.transform-box {
  width: 48px;
  height: 48px;
  background: #ea580c;
}
```

```js
import { waapi, utils } from 'animejs';

const nodes = utils.$('.transform-box');

waapi.animate(nodes, {
  x: () => `${utils.random(2, 10)}rem`,
  y: () => `${utils.random(-2, 2)}rem`,
  rotateX: () => utils.random(-70, 70),
  rotateY: () => utils.random(-70, 70),
  scale: () => utils.random(75, 130) / 100,
});
```

### Individual property parameters

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/individual-property-parameters/>

Each property can carry its own timing and easing when its value is written as an object containing at least `to` or `from`.

Useful when:

- one property should finish before the others
- one property needs a different ease
- you want a shared global loop or delay but property-level motion detail

Fresh example:

```html
<div class="prop-demo">
  <div class="prop-box"></div>
  <div class="prop-box"></div>
  <div class="prop-box"></div>
</div>
```

```css
.prop-demo {
  display: flex;
  gap: 14px;
}

.prop-box {
  width: 42px;
  height: 42px;
  background: #0891b2;
}
```

```js
import { waapi, stagger } from 'animejs';

waapi.animate('.prop-box', {
  y: {
    to: [0, -24, 0],
    duration: 900,
    ease: 'out(4)',
  },
  rotate: {
    from: -135,
    to: 0,
    ease: 'out(3)',
  },
  scale: {
    to: [0.8, 1.15, 0.9],
    ease: 'inOut(3)',
  },
  duration: 500,
  delay: stagger(80),
  loop: true,
});
```

### Spring and custom easings

Official page: <https://animejs.com/documentation/web-animation-api/improvements-to-the-web-animation-api/spring-and-custom-easings/>

Anime.js WAAPI accepts more than native easing strings. The docs show built-in easing helpers, custom functions, and springs all being valid inputs for `ease`.

Relevant imports from the official page:

```js
import { eases, spring } from 'animejs';
```

Built-in helper families highlighted by the docs:

| String form | Function form | Parameter shape |
| --- | --- | --- |
| `linear(...)` | `linear()` | coordinates |
| `steps(...)` | `steps()` | step count |
| `cubicBezier(...)` | `cubicBezier()` | four control points |
| `in(...)` | `in()` | power |
| `out(...)` | `out()` | power |
| `inOut(...)` | `inOut()` | power |

Official default:

- `ease` defaults to `'out(2)'`

Fresh example:

```html
<div class="ease-demo">
  <div class="ease-orb"></div>
  <div class="ease-orb"></div>
  <div class="ease-orb"></div>
</div>
```

```css
.ease-demo {
  display: grid;
  gap: 10px;
}

.ease-orb {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #9333ea;
}
```

```js
import { waapi, stagger, spring } from 'animejs';

waapi.animate('.ease-orb', {
  y: [0, -26, 0],
  ease: spring({ stiffness: 140, damping: 7 }),
  delay: stagger(100),
  loop: true,
});
```

## API differences with native WAAPI

Official overview: <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/>

The official comparison page shows the main shift clearly:

- native WAAPI uses `element.animate(keyframes, options)`
- Anime.js WAAPI uses `waapi.animate(targets, parameters)`
- Anime.js merges keyframe values, playback settings, and callbacks into one familiar config object

### `iterations`

Official page: <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/iterations/>

Anime.js replaces native `iterations` with `loop`, and `loop` counts repeats rather than total passes.

Official mapping:

| Native WAAPI | Anime.js | Effect |
| --- | --- | --- |
| `1` | `0` | play once |
| `3` | `2` | repeat twice after the first pass |
| `Infinity` | `Infinity`, `true`, or `-1` | loop forever |

Official accepts:

| Name | Accepts |
| --- | --- |
| `loop` | A number in `[0, Infinity]`, or a boolean where `true` means infinite looping |

Fresh example:

```html
<div class="loop-demo">
  <div class="loop-box"></div>
</div>
```

```css
.loop-box {
  width: 48px;
  height: 48px;
  background: #16a34a;
}
```

```js
import { waapi } from 'animejs';

waapi.animate('.loop-box', {
  translate: '12rem',
  loop: 2,
  alternate: true,
});
```

### `direction`

Official page: <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/direction/>

Anime.js splits native `direction` into two booleans: `reversed` and `alternate`.

Official mapping:

| Native WAAPI `direction` | `reversed` | `alternate` | Effect |
| --- | --- | --- | --- |
| `'forward'` | `false` | `false` | play forward |
| `'reverse'` | `true` | `false` | play backward |
| `'alternate'` | `false` | `true` | alternate on loop |
| `'alternate-reverse'` | `true` | `true` | start backward, then alternate |

Official accepts:

| Name | Accepts |
| --- | --- |
| `reversed` | `Boolean` |
| `alternate` | `Boolean` |

Fresh example:

```html
<div class="dir-demo">
  <div class="dir-box"></div>
</div>
```

```css
.dir-box {
  width: 52px;
  height: 24px;
  border-radius: 999px;
  background: #be123c;
}
```

```js
import { waapi } from 'animejs';

waapi.animate('.dir-box', {
  translate: '14rem',
  reversed: true,
  alternate: true,
  loop: 3,
});
```

### `easing`

Official page: <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/easing/>

The native `easing` option becomes `ease`, and the accepted input surface grows.

Official differences:

- `ease` replaces `easing`
- `ease` accepts Anime.js easing functions in addition to native WAAPI easing strings
- the default is `'out(2)'`, not `'linear'`

Official accepts:

| Name | Accepts |
| --- | --- |
| `ease` | Any valid Anime.js easing string or function, plus any valid native WAAPI easing string |

Fresh example:

```html
<div class="ease-diff-demo">
  <div class="ease-diff-box"></div>
  <div class="ease-diff-box"></div>
  <div class="ease-diff-box"></div>
</div>
```

```css
.ease-diff-demo {
  display: grid;
  gap: 10px;
}

.ease-diff-box {
  width: 34px;
  height: 34px;
  background: #f59e0b;
}
```

```js
import { waapi, stagger } from 'animejs';

waapi.animate('.ease-diff-box', {
  translate: '15rem',
  ease: 'inOut(5)',
  delay: stagger(80),
});
```

### `finished`

Official page: <https://animejs.com/documentation/web-animation-api/api-differences-with-native-waapi/finished/>

Instead of reading `animation.finished`, Anime.js exposes `animation.then()`.

Official parameter and return contract:

| Name | Type |
| --- | --- |
| `callback` | A function whose first argument is the animation itself |

Returns:

- `Promise`

Fresh example:

```html
<div class="then-demo">
  <div class="then-chip"></div>
  <output class="then-status">pending</output>
</div>
```

```css
.then-demo {
  display: flex;
  gap: 12px;
  align-items: center;
}

.then-chip {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #0ea5e9;
}
```

```js
import { waapi } from 'animejs';

waapi
  .animate('.then-chip', {
    translate: '11rem',
    alternate: true,
    loop: 1,
  })
  .then(animation => {
    document.querySelector('.then-status').value = `done:${Math.round(animation.currentTime)}`;
  });
```

## `waapi.convertEase()`

Official page: <https://animejs.com/documentation/web-animation-api/waapi-convertease/>

Use this helper when you have a JavaScript easing function and need a WAAPI-compatible easing value for native playback.

Official import and example shape:

```js
import { waapi, spring } from 'animejs';

const bounce = spring({ stiffness: 120 });
const converted = waapi.convertEase(bounce.ease);
```

Parameter and return notes:

- the official page does not publish a formal parameters table
- the rows below are inferred from the official example and description

| Name | Accepts | Notes |
| --- | --- | --- |
| `ease` | A JavaScript easing function, such as `spring(...).ease` | Inferred from the official example |

Inferred return:

- a WAAPI-compatible linear easing value suitable for native `easing`

Fresh example:

```html
<div class="convert-demo">
  <div class="convert-row">
    <div class="convert-box"></div>
    <span>soft spring</span>
  </div>
  <div class="convert-row">
    <div class="convert-box"></div>
    <span>medium spring</span>
  </div>
  <div class="convert-row">
    <div class="convert-box"></div>
    <span>snappy spring</span>
  </div>
</div>
```

```css
.convert-demo {
  display: grid;
  gap: 10px;
}

.convert-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.convert-box {
  width: 26px;
  height: 26px;
  background: #334155;
}
```

```js
import { waapi, spring } from 'animejs';

const presets = [
  spring({ stiffness: 90, damping: 9 }),
  spring({ stiffness: 130, damping: 8 }),
  spring({ stiffness: 180, damping: 7 }),
];

document.querySelectorAll('.convert-box').forEach((el, index) => {
  el.animate(
    {
      translate: ['0px', '220px'],
      rotate: ['0turn', '1turn'],
    },
    {
      duration: presets[index].duration,
      easing: waapi.convertEase(presets[index].ease),
      fill: 'forwards',
      delay: index * 180,
    }
  );
});
```

## Practical takeaways

- Use `waapi.animate()` for DOM animations that fit the native browser animation model and benefit from the lighter WAAPI-focused runtime.
- Prefer transform and opacity motion when hardware acceleration matters.
- Treat selector-based multi-target WAAPI animation plus `stagger()` as a major productivity win over manual `querySelectorAll()` loops.
- Use property-level objects when one property needs its own `duration`, `delay`, or `ease`.
- Use individual transform props when authoring convenience matters more than compositor acceleration.
- Remember that `loop` counts repeats, not total iterations.
- Reach for `animation.then()` instead of `animation.finished`.
- Use `waapi.convertEase()` when native WAAPI needs an easing value generated from a JavaScript easing function.

## When to load this file

- Load this file when the request is specifically about Anime.js WAAPI usage, tradeoffs, or migration from native `Element.animate()`.
- Pair it with [animation/SKILL.md](../animation/SKILL.md) for target families, animatable properties, and shared playback concepts.
- Pair it with [easings/SKILL.md](../easings/SKILL.md) when the question becomes mostly about easing selection or spring tuning.
