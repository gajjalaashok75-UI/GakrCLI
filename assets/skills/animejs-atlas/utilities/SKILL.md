---
name: animejs-utilities
description: Anime.js utilities reference covering stagger, DOM helpers, cleanup helpers, synchronization helpers, randomizers, math helpers, interpolation helpers, formatting helpers, and chain-able utility functions. Use when shaping values or building Anime.js modifiers and helper flows.
---

# Anime.js Utilities Companion

Use this file when a task touches Anime.js helper functions, staggered value generation, DOM utility helpers, cleanup helpers, seeded randomness, numeric modifiers, formatter chains, or reusable `modifier` pipelines.

## Official reference

- Utilities overview: <https://animejs.com/documentation/utilities/>
- This companion covers every utility listed there:
  - `stagger()`: <https://animejs.com/documentation/utilities/stagger/>
  - `$()`: <https://animejs.com/documentation/utilities/dollar-sign/>
  - `get()`: <https://animejs.com/documentation/utilities/get/>
  - `set()`: <https://animejs.com/documentation/utilities/set/>
  - `cleanInlineStyles()`: <https://animejs.com/documentation/utilities/clean-inline-styles/>
  - `remove()`: <https://animejs.com/documentation/utilities/remove/>
  - `sync()`: <https://animejs.com/documentation/utilities/sync/>
  - `keepTime()`: <https://animejs.com/documentation/utilities/createtimekeeper/>
  - `random()`: <https://animejs.com/documentation/utilities/random/>
  - `createSeededRandom()`: <https://animejs.com/documentation/utilities/createseededrandom/>
  - `randomPick()`: <https://animejs.com/documentation/utilities/random-pick/>
  - `shuffle()`: <https://animejs.com/documentation/utilities/shuffle/>
  - `round()`: <https://animejs.com/documentation/utilities/round/>
  - `clamp()`: <https://animejs.com/documentation/utilities/clamp/>
  - `snap()`: <https://animejs.com/documentation/utilities/snap/>
  - `wrap()`: <https://animejs.com/documentation/utilities/wrap/>
  - `mapRange()`: <https://animejs.com/documentation/utilities/map-range/>
  - `lerp()`: <https://animejs.com/documentation/utilities/lerp/>
  - `damp()`: <https://animejs.com/documentation/utilities/damp/>
  - `roundPad()`: <https://animejs.com/documentation/utilities/round-pad/>
  - `padStart()`: <https://animejs.com/documentation/utilities/pad-start/>
  - `padEnd()`: <https://animejs.com/documentation/utilities/pad-end/>
  - `degToRad()`: <https://animejs.com/documentation/utilities/deg-to-rad/>
  - `radToDeg()`: <https://animejs.com/documentation/utilities/rad-to-deg/>
  - Chain-able utility functions: <https://animejs.com/documentation/utilities/chain-able-utility-functions/>

## Official section map

- Utilities overview: <https://animejs.com/documentation/utilities/>
- `stagger()`: <https://animejs.com/documentation/utilities/stagger/>
- `$()`: <https://animejs.com/documentation/utilities/dollar-sign/>
- `get()`: <https://animejs.com/documentation/utilities/get/>
- `set()`: <https://animejs.com/documentation/utilities/set/>
- `cleanInlineStyles()`: <https://animejs.com/documentation/utilities/clean-inline-styles/>
- `remove()`: <https://animejs.com/documentation/utilities/remove/>
- `sync()`: <https://animejs.com/documentation/utilities/sync/>
- `keepTime()`: <https://animejs.com/documentation/utilities/createtimekeeper/>
- `random()`: <https://animejs.com/documentation/utilities/random/>
- `createSeededRandom()`: <https://animejs.com/documentation/utilities/createseededrandom/>
- `randomPick()`: <https://animejs.com/documentation/utilities/random-pick/>
- `shuffle()`: <https://animejs.com/documentation/utilities/shuffle/>
- `round()`: <https://animejs.com/documentation/utilities/round/>
- `clamp()`: <https://animejs.com/documentation/utilities/clamp/>
- `snap()`: <https://animejs.com/documentation/utilities/snap/>
- `wrap()`: <https://animejs.com/documentation/utilities/wrap/>
- `mapRange()`: <https://animejs.com/documentation/utilities/map-range/>
- `lerp()`: <https://animejs.com/documentation/utilities/lerp/>
- `damp()`: <https://animejs.com/documentation/utilities/damp/>
- `roundPad()`: <https://animejs.com/documentation/utilities/round-pad/>
- `padStart()`: <https://animejs.com/documentation/utilities/pad-start/>
- `padEnd()`: <https://animejs.com/documentation/utilities/pad-end/>
- `degToRad()`: <https://animejs.com/documentation/utilities/deg-to-rad/>
- `radToDeg()`: <https://animejs.com/documentation/utilities/rad-to-deg/>
- Chain-able utility functions: <https://animejs.com/documentation/utilities/chain-able-utility-functions/>

## Imports

Import through the root package when you are already using timers, animations, or timelines:

```javascript
import {
  utils,
  stagger,
  $,
  get,
  set,
  cleanInlineStyles,
  remove,
  sync,
  keepTime,
  random,
  createSeededRandom,
  randomPick,
  shuffle,
  round,
  clamp,
  snap,
  wrap,
  mapRange,
  lerp,
  damp,
  roundPad,
  padStart,
  padEnd,
  degToRad,
  radToDeg,
} from 'animejs';
```

Import the utilities layer directly when you only need helpers:

```javascript
import {
  stagger,
  $,
  get,
  set,
  cleanInlineStyles,
  remove,
  sync,
  keepTime,
  random,
  createSeededRandom,
  randomPick,
  shuffle,
  round,
  clamp,
  snap,
  wrap,
  mapRange,
  lerp,
  damp,
  roundPad,
  padStart,
  padEnd,
  degToRad,
  radToDeg,
} from 'animejs/utils';
```

Import via the namespace object when you want the docs-style API surface:

```javascript
import { utils } from 'animejs';

utils.random(0, 100);
utils.clamp(0, 1);
utils.stagger(80);
```

## Shared demo CSS

Reuse this tiny base when you want simple docs-like utility demos:

```css
.demo-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  margin-block: 0.75rem;
}

.demo-box,
.demo-dot {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 0.75rem;
  background: #1f2937;
  color: #f9fafb;
}

.demo-dot {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #22c55e;
}

.demo-log {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #111827;
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(4, 2.5rem);
  gap: 0.5rem;
}
```

## `stagger()`

- Official page: <https://animejs.com/documentation/utilities/stagger/>
- Direct subsection links:
  - Time staggering: <https://animejs.com/documentation/utilities/stagger/time-staggering/>
  - Values staggering: <https://animejs.com/documentation/utilities/stagger/values-staggering/>
  - Timeline positions staggering: <https://animejs.com/documentation/utilities/stagger/timeline-positions-staggering/>
  - Value types: <https://animejs.com/documentation/utilities/stagger/stagger-value-types/>
  - Numerical value: <https://animejs.com/documentation/utilities/stagger/stagger-value-types/numerical-value/>
  - Range value: <https://animejs.com/documentation/utilities/stagger/stagger-value-types/range-value/>
  - Stagger parameters: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/>
  - `start`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-start/>
  - `from`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-from/>
  - `reversed`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-reversed/>
  - `ease`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-ease/>
  - `grid`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-grid/>
  - `axis`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-grid-axis/>
  - `modifier`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-modifier/>
  - `use`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-use/>
  - `total`: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-total/>

Creates a function-based value that spreads timing or values across multiple targets in order, from a chosen origin, or across a grid.

### Signature

```javascript
const functionValue = stagger(value, parameters);
```

### Parameters

| Name | Accepts |
| --- | --- |
| `value` | A stagger value source |
| `parameters` | Optional stagger configuration |

### Returns

Function-based value for multi-target animations or timeline positions.

### Fresh overview example

```javascript
import { animate, stagger } from 'animejs';

animate('.chip', {
  x: '14rem',
  scale: stagger([1, 0.55]),
  delay: stagger(90),
  alternate: true,
  loop: true,
});
```

```html
<div class="demo-row">
  <div class="demo-box chip">1</div>
  <div class="demo-box chip">2</div>
  <div class="demo-box chip">3</div>
  <div class="demo-box chip">4</div>
</div>
```

```css
.chip {
  background: #0f766e;
}
```

### Time staggering

Tween time-related properties such as `delay` and `duration` accept function-based values, which means the function returned by `stagger()` can progressively offset each target in a multi-target animation.

The result is that each target gets its own timing value, usually increasing by a fixed amount for every next target.

```javascript
import { animate, stagger } from 'animejs';

animate('.square', {
  x: '17rem',
  delay: stagger(100),
  duration: stagger(200, { start: 500 }),
  loop: true,
  alternate: true,
});
```

```html
<div class="demo-row">
  <div class="demo-box square">1</div>
  <div class="demo-box square">2</div>
  <div class="demo-box square">3</div>
  <div class="demo-box square">4</div>
</div>
```

```css
.square {
  background: #1d4ed8;
}
```

### Values staggering

Use the returned function on animatable values when every target should land on a different result.

```javascript
import { animate, stagger } from 'animejs';

animate('.bar', {
  y: stagger(['-3rem', '3rem']),
  rotate: stagger([0, 180]),
  alternate: true,
  loop: true,
});
```

```html
<div class="demo-row">
  <div class="demo-box bar"></div>
  <div class="demo-box bar"></div>
  <div class="demo-box bar"></div>
  <div class="demo-box bar"></div>
  <div class="demo-box bar"></div>
</div>
```

### Timeline positions staggering

The timeline `add()` position argument also accepts function-based values, so a single multi-target addition can fan out into several offset starts.

```javascript
import { createTimeline, stagger } from 'animejs';

createTimeline()
  .add('.step', {
    x: '10rem',
    opacity: [0, 1],
    duration: 350,
  }, stagger(180, { start: 200 }))
  .init();
```

```html
<div class="demo-row">
  <div class="demo-box step">A</div>
  <div class="demo-box step">B</div>
  <div class="demo-box step">C</div>
</div>
```

### Value types

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-value-types/>

#### Numerical value

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-value-types/numerical-value/>
- Accepts: `Number`, or a `String` that contains at least one number

Interpret the source as the per-target increment.

```javascript
import { animate, stagger } from 'animejs';

animate('.lane', {
  x: stagger('4rem'),
  delay: stagger(70),
});
```

#### Range value

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-value-types/range-value/>
- Accepts: `[Number | String, Number | String]`

Interpret the source as a start/end span, then distribute targets evenly through it.

```javascript
import { animate, stagger } from 'animejs';

animate('.tile', {
  y: stagger(['2rem', '-2rem']),
  opacity: stagger([0.35, 1]),
});
```

### Parameters

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/>

#### `start`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-start/>
- Accepts: `Number`, or timeline time-position syntax when used as a timeline position argument
- Default: `0`

Offsets the beginning of the calculated sequence.

```javascript
delay: stagger(100, { start: 300 });
x: stagger('1rem', { start: 8 });
```

#### `from`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-from/>
- Accepts: index `Number`, `'first'`, `'center'`, `'last'`, `'random'`
- Default: `0`

Controls the origin point of the spread.

```javascript
import { animate, stagger } from 'animejs';

animate('.pulse', {
  scale: [1, 0.3],
  delay: stagger(45, { from: 'center' }),
});
```

#### `reversed`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-reversed/>
- Accepts: `Boolean`
- Default: `false`

Flips the direction of the generated order.

```javascript
animate('.note', {
  x: '12rem',
  delay: stagger(80, { reversed: true }),
});
```

#### `ease`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-ease/>
- Accepts: any Anime.js ease expression
- Default: `'linear'`

Shapes the spacing between staggered results rather than the tween itself.

```javascript
animate('.wave', {
  y: stagger(['2rem', '-2rem'], { ease: 'inOut(3)' }),
  delay: stagger(70, { ease: 'inOut(3)' }),
});
```

#### `grid`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-grid/>
- Accepts: `[Number, Number]`
- Default: `null`

Treats the target list as a 2D matrix before distances are computed.

```javascript
import { animate, stagger } from 'animejs';

animate('.cell', {
  scale: [{ to: 1.15 }, { to: 1 }],
  delay: stagger(60, { grid: [4, 3], from: 'center' }),
});
```

```html
<div class="demo-grid">
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
  <div class="demo-box cell"></div>
</div>
```

#### `axis`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-grid-axis/>
- Accepts: `'x'` or `'y'`

Restricts a grid stagger so only horizontal or vertical distance contributes.

```javascript
animate('.axis-cell', {
  x: stagger(['-2rem', '2rem'], { grid: [4, 3], axis: 'x' }),
  y: stagger(['-1rem', '1rem'], { grid: [4, 3], axis: 'y' }),
});
```

#### `modifier`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-modifier/>
- Accepts: a function that receives `value`
- Must return: `Number` or `String`

Lets you post-process the computed stagger result before Anime.js applies it.

```javascript
animate('.shadow-card', {
  boxShadow: [{
    to: stagger([0.25, 1], {
      from: 'center',
      modifier: value => `0 0 ${value * 18}px rgba(34, 197, 94, 0.55)`,
    }),
  }],
});
```

#### `use`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-use/>
- Accepts: attribute or property name `String`
- Default: `null`

Builds the order from a target property or attribute instead of DOM order. The doc note matters here: if your custom indices do not reach the full target count and you also use `from`, `reversed`, or `ease`, pair `use` with `total`.

```javascript
animate('.ranked', {
  rotate: 90,
  delay: stagger(160, { use: 'data-rank' }),
});
```

```html
<div class="demo-row">
  <div class="demo-box ranked" data-rank="2">2</div>
  <div class="demo-box ranked" data-rank="0">0</div>
  <div class="demo-box ranked" data-rank="3">3</div>
  <div class="demo-box ranked" data-rank="1">1</div>
</div>
```

#### `total`

- Official page: <https://animejs.com/documentation/utilities/stagger/stagger-parameters/stagger-total/>
- Accepts: `Number`
- Default: `null`

Overrides the effective stagger length. This is most useful with custom `use` indices.

```javascript
animate('.bucketed', {
  x: '10rem',
  delay: stagger(140, {
    use: 'data-band',
    total: 2,
    reversed: true,
  }),
});
```

## DOM and state helpers

### `$()`

- Official page: <https://animejs.com/documentation/utilities/dollar-sign/>
- Summary: turns selectors or DOM elements into a real array; inside a scope it queries from the scope root instead of `document`
- Parameters:
  - `targets`: CSS selector or DOM element(s)
- Returns:
  - `Array<HTMLElement | SVGElement | SVGGeometryElement>`

```javascript
import { $, animate } from 'animejs';

const cards = $('.card');
animate(cards, {
  opacity: [0, 1],
  y: ['1rem', 0],
  delay: (_, i) => i * 80,
});
```

```html
<div class="demo-row">
  <div class="demo-box card">A</div>
  <div class="demo-box card">B</div>
  <div class="demo-box card">C</div>
</div>
```

### `get()`

- Official page: <https://animejs.com/documentation/utilities/get/>
- Parameters:
  - `target`: any Anime.js target
  - `property`: property name string
  - `unit` optional: `false` to strip units, or a unit string to convert
- Returns:
  - the native property value type
  - `String` for DOM/SVG values when units are preserved or converted
  - `Number` for DOM/SVG values when `unit === false`

```javascript
import { get, set } from 'animejs';

set('.meter', { width: '12rem' });

const raw = get('.meter', 'width');
const px = get('.meter', 'width', false);
const rem = get('.meter', 'width', 'rem');

console.log({ raw, px, rem });
```

```html
<div class="demo-row">
  <div class="demo-box meter" style="width: 4rem;">M</div>
</div>
```

### `set()`

- Official page: <https://animejs.com/documentation/utilities/set/>
- Parameters:
  - `targets`: one or more Anime.js targets
  - `properties`: object of values to apply immediately
- Returns:
  - `Animation`
- Notes from the docs:
  - Great for one-off setup or teardown writes
  - Prefer an `Animatable` for repeated writes to the same target/property pair
  - It will not create a missing DOM or SVG attribute for you

```javascript
import { set } from 'animejs';

set('.badge', {
  opacity: 1,
  scale: 1.1,
  x: '2rem',
  rotate: '12deg',
});
```

```html
<div class="demo-row">
  <div class="demo-box badge">NEW</div>
</div>
```

### `cleanInlineStyles()`

- Official page: <https://animejs.com/documentation/utilities/clean-inline-styles/>
- Parameters:
  - `instance`: `Animation` or `Timeline`
- Returns:
  - the same instance
- Typical use:
  - call it directly on an instance
  - or wire it into `onComplete`

```javascript
import { animate, cleanInlineStyles } from 'animejs';

const fade = animate('.temporary-style', {
  x: '8rem',
  backgroundColor: '#ef4444',
  duration: 500,
  onComplete: self => cleanInlineStyles(self),
});
```

```html
<div class="demo-row">
  <div class="demo-box temporary-style">X</div>
</div>
```

### `remove()`

- Official page: <https://animejs.com/documentation/utilities/remove/>
- Parameters:
  - `targets`: Anime.js targets
  - `instance` optional: animation or timeline
  - `propertyName` optional: animatable property name
- Returns:
  - array of removed target elements

```javascript
import { animate, remove } from 'animejs';

const pulse = animate('.worker', {
  x: '12rem',
  rotate: 180,
  alternate: true,
  loop: true,
});

remove('.worker--paused', pulse, 'x');
```

```html
<div class="demo-row">
  <div class="demo-box worker worker--paused">1</div>
  <div class="demo-box worker">2</div>
</div>
```

### `sync()`

- Official page: <https://animejs.com/documentation/utilities/sync/>
- Parameters:
  - `callback`: `Function`
- Returns:
  - `Timer`

Runs a callback on Anime.js's engine loop so state writes land in the same timing system as the rest of your animation work.

```javascript
import { animate, sync } from 'animejs';

const animation = animate('.sync-ball', {
  x: '14rem',
  alternate: true,
  loop: true,
});

document.querySelector('#half-speed').addEventListener('click', () => {
  sync(() => {
    animation.speed = 0.5;
  });
});
```

```html
<div class="demo-row">
  <div class="demo-box sync-ball"></div>
  <button id="half-speed">Half speed</button>
</div>
```

### `keepTime()`

- Official page: <https://animejs.com/documentation/utilities/createtimekeeper/>
- Parameters:
  - `constructor`: function that returns a `Timer`, `Animation`, or `Timeline`
- Returns:
  - function that rebuilds the instance while preserving current time

Use this when you need to recreate an animation with new targets or settings without snapping playback back to zero.

```javascript
import { animate, keepTime } from 'animejs';

const targets = ['.clock-a', '.clock-b', '.clock-c'];
let index = 0;

const playNext = keepTime(() => {
  const target = targets[index % targets.length];
  index += 1;
  return animate(target, {
    rotate: 360,
    duration: 6000,
    ease: 'linear',
    loop: true,
  });
});

playNext();
document.querySelector('#switch-target').addEventListener('click', playNext);
```

```html
<div class="demo-row">
  <div class="demo-box clock-a">A</div>
  <div class="demo-box clock-b">B</div>
  <div class="demo-box clock-c">C</div>
  <button id="switch-target">Switch target</button>
</div>
```

## Randomness helpers

### `random()`

- Official page: <https://animejs.com/documentation/utilities/random/>
- Parameters:
  - `min`: `Number`
  - `max`: `Number`
  - `decimalLength` optional, default `0`: `Number`
- Returns:
  - `Number`

```javascript
import { random, set } from 'animejs';

set('.confetti', {
  x: () => `${random(0, 18, 2)}rem`,
  y: () => `${random(-2, 4, 1)}rem`,
  rotate: () => random(0, 360),
});
```

### `createSeededRandom()`

- Official page: <https://animejs.com/documentation/utilities/createseededrandom/>
- Parameters:
  - `seed` optional, default `0`: `Number`
  - `seededMin` optional, default `0`: `Number`
  - `seededMax` optional, default `1`: `Number`
  - `seededDecimalLength` optional, default `0`: `Number`
- Returns:
  - a pre-seeded `random()`-style function

```javascript
import { createSeededRandom, set } from 'animejs';

const seeded = createSeededRandom(20260426);

set('.seeded-dot', {
  x: () => `${seeded(0, 14, 2)}rem`,
  y: () => `${seeded(-2, 2, 2)}rem`,
  scale: () => seeded(0.5, 1.4, 2),
});
```

### `randomPick()`

- Official page: <https://animejs.com/documentation/utilities/random-pick/>
- Parameters:
  - `collection`: `Array`, `NodeList`, or `String`
- Returns:
  - one randomly selected member

```javascript
import { randomPick } from 'animejs';

const label = randomPick(['north', 'south', 'east', 'west']);
const tone = randomPick(['#16a34a', '#0891b2', '#ea580c']);
const glyph = randomPick('ABCD');

console.log({ label, tone, glyph });
```

### `shuffle()`

- Official page: <https://animejs.com/documentation/utilities/shuffle/>
- Parameters:
  - `array`: `Array`
- Returns:
  - the same array, mutated into a new order

```javascript
import { animate, set, shuffle, stagger, $ } from 'animejs';

const tiles = $('.shuffle-tile');
const x = stagger('3rem');

set(tiles, { x });

document.querySelector('#reshuffle').addEventListener('click', () => {
  animate(shuffle(tiles), { x });
});
```

```html
<div class="demo-row">
  <div class="demo-box shuffle-tile">1</div>
  <div class="demo-box shuffle-tile">2</div>
  <div class="demo-box shuffle-tile">3</div>
  <div class="demo-box shuffle-tile">4</div>
  <button id="reshuffle">Shuffle</button>
</div>
```

## Numeric modifier helpers

### `round()`

- Official page: <https://animejs.com/documentation/utilities/round/>
- Parameters:
  - `value` optional: `Number`
  - `decimalLength`: `Number`
- Returns:
  - `Number` when a value is supplied
  - chain-able utility function when only `decimalLength` is supplied

```javascript
import { round } from 'animejs';

round(3.14159, 2);        // 3.14
const round2 = round(2);
round2(9.8765);           // 9.88
```

### `clamp()`

- Official page: <https://animejs.com/documentation/utilities/clamp/>
- Parameters:
  - `value` optional: `Number`
  - `min`: `Number`
  - `max`: `Number`
- Returns:
  - `Number` or a chain-able clamp function

```javascript
import { clamp } from 'animejs';

clamp(140, 0, 100);       // 100
const withinUnit = clamp(0, 1);
withinUnit(1.25);         // 1
```

### `snap()`

- Official page: <https://animejs.com/documentation/utilities/snap/>
- Parameters:
  - `value` optional: `Number`
  - `increment`: `Number` or `Array<Number>`
- Returns:
  - `Number` or a chain-able snap function

```javascript
import { snap } from 'animejs';

snap(93, 10);                  // 90
snap(73, [0, 50, 100]);        // 50
const snapGrid = snap(24);
snapGrid(77);                  // 72
```

### `wrap()`

- Official page: <https://animejs.com/documentation/utilities/wrap/>
- Parameters:
  - `value` optional: `Number`
  - `min`: `Number`
  - `max`: `Number`
- Returns:
  - `Number` or a chain-able wrap function

```javascript
import { wrap } from 'animejs';

wrap(105, 0, 100);         // 5
const wrapHue = wrap(0, 360);
wrapHue(390);              // 30
```

### `mapRange()`

- Official page: <https://animejs.com/documentation/utilities/map-range/>
- Parameters:
  - `value` optional: `Number`
  - `fromLow`: `Number`
  - `fromHigh`: `Number`
  - `toLow`: `Number`
  - `toHigh`: `Number`
- Returns:
  - `Number` or a chain-able mapping function

```javascript
import { mapRange } from 'animejs';

mapRange(50, 0, 100, 0, 1);  // 0.5
const normalize = mapRange(-200, 200, 0, 1);
normalize(100);              // 0.75
```

### `lerp()`

- Official page: <https://animejs.com/documentation/utilities/lerp/>

Interpolates a value between two numbers from a given progress value, or returns a reusable interpolation function when the `progress` argument is omitted.

### Signature

```javascript
const interpolatedValue = lerp(start, end, progress);
const interpolatorFunction = lerp(start, end);
```

### Parameters

| Name | Accepts |
| --- | --- |
| `start` | `Number` |
| `end` | `Number` |
| `progress` optional | `Number` from `0` to `1` |

### Returns

- `Number` when `progress` is provided
- a chain-able utility function when `progress` is omitted

```javascript
import { lerp } from 'animejs';

const interpolateBetween0and100 = lerp(0, 100);

interpolateBetween0and100(0.5);  // 50
interpolateBetween0and100(0.75); // 75
interpolateBetween0and100(0.25); // 25

const interpolateAndRound = lerp(0, 100).round(2);
interpolateAndRound(0.677523); // 67.75
interpolateAndRound(1.202514); // 100
```

### `lerp()` code example

```javascript
import { animate, utils } from 'animejs';

animate('.normal', {
  rotate: '1turn',
  duration: 3000,
  loop: true,
  ease: 'inOut',
});

animate('.interpolated', {
  rotate: '1turn',
  modifier: utils.lerp(0, 12),
  duration: 3000,
  loop: true,
  ease: 'inOut',
});
```

```html
<div class="demo-row">
  <div class="demo-box normal">1x</div>
  <div class="demo-box interpolated">lerp</div>
</div>
```

```css
.normal {
  background: #0f766e;
}

.interpolated {
  background: #7c3aed;
}
```

### `damp()`

- Official page: <https://animejs.com/documentation/utilities/damp/>

A frame-rate independent version of `utils.lerp()` that performs linear interpolation between two values while remaining stable across different update rates.

The closer `amount` is to `1`, the closer the result moves toward the `end` value.

### Signature

```javascript
const damped = damp(start, end, deltaTime, amount);
```

### Parameters

| Name | Accepts |
| --- | --- |
| `start` | `Number` |
| `end` | `Number` |
| `deltaTime` | `Number` in milliseconds |
| `amount` | `Number` from `0` to `1` |

### Returns

`Number`

```javascript
import { damp } from 'animejs';

damp(0, 100, 8, 0);   // 0
damp(0, 100, 8, 0.5); // 50
damp(0, 100, 8, 1);   // 100
```

### `damp()` code example

```javascript
import { animate, createTimer, utils } from 'animejs';

const [$input] = utils.$('.input');
const [$lerped] = utils.$('.lerped');
const [$damped] = utils.$('.damped');

animate($input, {
  rotate: '1000turn',
  modifier: utils.snap(.25),
  duration: 4000000,
  loop: true,
  ease: 'linear',
});

createTimer({
  frameRate: 15,
  onUpdate: clock => {
    const sourceRotate = utils.get($input, 'rotate', false);
    const dampedRotate = utils.get($damped, 'rotate', false);
    utils.set($damped, {
      rotate: utils.damp(dampedRotate, sourceRotate, clock.deltaTime, .075) + 'turn',
    });
  }
});

createTimer({
  frameRate: 15,
  onUpdate: () => {
    const sourceRotate = utils.get($input, 'rotate', false);
    const lerpedRotate = utils.get($lerped, 'rotate', false);
    utils.set($lerped, {
      rotate: utils.lerp(lerpedRotate, sourceRotate, .075) + 'turn',
    });
  }
});
```

```html
<div class="demo-row">
  <div class="demo-box input">input</div>
  <div class="demo-box lerped">lerp</div>
  <div class="demo-box damped">damp</div>
</div>
```

```css
.input {
  background: #b91c1c;
}

.lerped {
  background: #0f766e;
}

.damped {
  background: #7c3aed;
}
```

## String and formatting helpers

### `roundPad()`

- Official page: <https://animejs.com/documentation/utilities/round-pad/>

Rounds a numeric value, pads its decimal part to the requested length, or returns a reusable chain-able formatter when the value argument is omitted.

### Signature

```javascript
const formattedValue = roundPad(value, decimalLength);
const formatterFunction = roundPad(decimalLength);
```

### Parameters

| Name | Accepts |
| --- | --- |
| `value` optional | `Number` or `String` |
| `decimalLength` | `Number` |

### Returns

- `String` when the value is provided
- a chain-able round-and-pad formatter when the value is omitted

```javascript
import { roundPad } from 'animejs';

roundPad(8.1, 3);          // "8.100"
const moneyLike = roundPad(2);
moneyLike(42);             // "42.00"
```

### `roundPad()` code example

```javascript
import { animate, utils } from 'animejs';

animate('.roundpad-counter', {
  innerHTML: 100,
  modifier: utils.roundPad(2),
  duration: 2600,
  ease: 'linear',
  loop: true,
  alternate: true,
});
```

```html
<div class="demo-log">
  <span class="roundpad-counter">0.00</span>
</div>
```

```css
.roundpad-counter {
  font-variant-numeric: tabular-nums;
}
```

### `padStart()`

- Official page: <https://animejs.com/documentation/utilities/pad-start/>
- Parameters:
  - `value` optional: `String` or `Number`
  - `totalLength`: `Number`
  - `padString`: `String`
- Returns:
  - `String`, or a chain-able padding function

```javascript
import { padStart } from 'animejs';

padStart(7, 3, '0');          // "007"
const leftFill = padStart(6, '-');
leftFill(42);                 // "----42"
```

### `padEnd()`

- Official page: <https://animejs.com/documentation/utilities/pad-end/>
- Parameters:
  - `value` optional: `String` or `Number`
  - `totalLength`: `Number`
  - `padString`: `String`
- Returns:
  - `String`, or a chain-able padding function

```javascript
import { padEnd } from 'animejs';

padEnd('A', 4, '.');         // "A..."
const rightFill = padEnd(5, '0');
rightFill(73);               // "73000"
```

## Angle conversion helpers

### `degToRad()`

- Official page: <https://animejs.com/documentation/utilities/deg-to-rad/>
- Parameters:
  - `degrees` optional: `Number`
- Returns:
  - `Number`, or a chain-able converter

```javascript
import { degToRad } from 'animejs';

degToRad(180);               // Math.PI
const shortRad = degToRad().round(2);
shortRad(90);                // 1.57
```

### `radToDeg()`

- Official page: <https://animejs.com/documentation/utilities/rad-to-deg/>
- Parameters:
  - `radians` optional: `Number`
- Returns:
  - `Number`, or a chain-able converter

```javascript
import { radToDeg } from 'animejs';

radToDeg(Math.PI / 2);       // 90
const shortDeg = radToDeg().round(1);
shortDeg(Math.PI / 3);       // 60.0
```

## Chain-able utility functions

- Official page: <https://animejs.com/documentation/utilities/chain-able-utility-functions/>
- The page documents chaining for:
  - `round()`
  - `clamp()`
  - `snap()`
  - `wrap()`
  - `mapRange()`
  - `interpolate()` on that page's wording; the current utilities navigation points to the `lerp()` helper page
  - `roundPad()`
  - `padStart()`
  - `padEnd()`
  - `degToRad()`
  - `radToDeg()`

### Usage

Calling a chain-capable helper without its optional "value" argument returns a function instead of a final result.

```javascript
import { clamp } from 'animejs';

const clampToPercent = clamp(0, 100);
clampToPercent(140); // 100
```

### Chaining

You can keep appending supported utilities to build a reusable modifier pipeline.

```javascript
import { mapRange } from 'animejs';

const normalizeAndRound = mapRange(0, 255, 0, 1).round(2);
normalizeAndRound(128); // 0.5
```

### Fresh modifier pipeline example

```javascript
import { animate, wrap } from 'animejs';

animate('.counter', {
  innerHTML: 1000,
  modifier: wrap(0, 12).roundPad(2).padStart(5, '0'),
  duration: 12000,
  ease: 'linear',
  alternate: true,
  loop: true,
});
```

```html
<div class="demo-log">
  <span class="counter">00.00</span>
</div>
```

## Practical pairing notes

- Use `stagger()` with `animate()`, `createTimeline()`, and text splitting workflows.
- Use `get()` plus `set()` when bridging from measured state to immediate layout prep.
- Use `cleanInlineStyles()` after entrance or exit animations when CSS classes should retake control.
- Use `sync()` for engine-loop-safe state writes.
- Use `keepTime()` when rebuilding an animation in response to resize, filtering, or target switches.
- Use chain-able utilities for `modifier` pipelines instead of hand-written inline math when the transformation is reusable.

## When to load this file

- Load this whenever a task mentions utilities, helper methods, randomization, mapping, snapping, clamping, padding, or staggered multi-target behavior.
- Pair it with [animation/SKILL.md](../animation/SKILL.md) when the question also touches tween params or modifiers.
- Pair it with [timeline/SKILL.md](../timeline/SKILL.md) when the stagger is used as a timeline position helper.
- Pair it with [scope/SKILL.md](../scope/SKILL.md) when `$()` or `keepTime()` is being used inside a scope.
