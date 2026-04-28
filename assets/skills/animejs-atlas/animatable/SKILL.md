---
name: animejs-animatable
description: Anime.js createAnimatable() reference covering settings, methods, and properties for fast repeated property updates. Use when driving frequently changing values, pointer-following motion, or custom animatable state containers.
---

# Animatable Module

Use Anime.js `createAnimatable()` when you want direct, repeatable control over property updates and expect those values to change often during input handling, cursor tracking, or custom loops.

## Official reference

- Main page: <https://animejs.com/documentation/animatable/>
- Settings hub: <https://animejs.com/documentation/animatable/animatable-settings/>
- `unit`: <https://animejs.com/documentation/animatable/animatable-settings/unit/>
- `duration`: <https://animejs.com/documentation/animatable/animatable-settings/duration/>
- `ease`: <https://animejs.com/documentation/animatable/animatable-settings/ease/>
- `modifier`: <https://animejs.com/documentation/animatable/animatable-settings/modifier/>
- Methods hub: <https://animejs.com/documentation/animatable/animatable-methods/>
- Getters: <https://animejs.com/documentation/animatable/animatable-methods/getters/>
- Setters: <https://animejs.com/documentation/animatable/animatable-methods/setters/>
- `revert()`: <https://animejs.com/documentation/animatable/animatable-methods/revert/>
- Properties: <https://animejs.com/documentation/animatable/animatable-properties/>

## Official section map

- Core
  - Animatable: <https://animejs.com/documentation/animatable/>
- Settings
  - Settings hub: <https://animejs.com/documentation/animatable/animatable-settings/>
  - `unit`: <https://animejs.com/documentation/animatable/animatable-settings/unit/>
  - `duration`: <https://animejs.com/documentation/animatable/animatable-settings/duration/>
  - `ease`: <https://animejs.com/documentation/animatable/animatable-settings/ease/>
  - `modifier`: <https://animejs.com/documentation/animatable/animatable-settings/modifier/>
- Methods
  - Methods hub: <https://animejs.com/documentation/animatable/animatable-methods/>
  - Getters: <https://animejs.com/documentation/animatable/animatable-methods/getters/>
  - Setters: <https://animejs.com/documentation/animatable/animatable-methods/setters/>
  - `revert()`: <https://animejs.com/documentation/animatable/animatable-methods/revert/>
- Properties
  - Properties: <https://animejs.com/documentation/animatable/animatable-properties/>

## Imports

Import from the main package when you are already using other Anime.js APIs:

```javascript
import { createAnimatable } from 'animejs';
```

Import from the focused subpath when you only want the animatable helper:

```javascript
import { createAnimatable } from 'animejs/animatable';
```

## Constructor signature

```javascript
const animatable = createAnimatable(targets, parameters);
```

### Parameters

| Name | Accepts | Notes |
|------|---------|-------|
| `targets` | Anime.js `Targets` | Same target shapes used across Anime.js animation APIs |
| `parameters` | Object | Combines animatable properties with animatable settings |

### Returns

`Animatable`

The returned object exposes one method per declared property:

```javascript
animatable.propertyName(); // Read the current value
animatable.propertyName(value, duration, ease); // Animate to a new value
```

Anime.js notes a performance constraint here: property methods accept only `Number` values or `Array<Number>` values.

## Overview example

This example uses `createAnimatable()` as a pointer follower. The property durations live on the animatable instance, so repeated updates stay compact.

```javascript
import { createAnimatable, utils } from 'animejs';

const panel = document.querySelector('.anim-panel');
const puck = createAnimatable('.anim-puck', {
  x: 260,
  y: 260,
  scale: { duration: 160 },
  ease: 'out(4)',
});

function movePuck(event) {
  const rect = panel.getBoundingClientRect();
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const x = utils.clamp(event.clientX - rect.left - halfW, -halfW + 28, halfW - 28);
  const y = utils.clamp(event.clientY - rect.top - halfH, -halfH + 28, halfH - 28);

  puck.x(x).y(y).scale(1.08);
}

function resetPuck() {
  puck.x(0, 240, 'outQuad').y(0, 240, 'outQuad').scale(1, 220, 'out(3)');
}

panel.addEventListener('pointermove', movePuck);
panel.addEventListener('pointerleave', resetPuck);
```

```html
<section class="anim-panel">
  <div class="anim-grid"></div>
  <div class="anim-puck"></div>
</section>
```

```css
.anim-panel {
  position: relative;
  width: min(32rem, 90vw);
  height: 18rem;
  margin: 2rem auto;
  overflow: hidden;
  border: 1px solid #17324d;
  border-radius: 1.25rem;
  background:
    radial-gradient(circle at top, #1d4c73 0%, #0d2030 55%, #08131d 100%);
}

.anim-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 2rem 2rem;
}

.anim-puck {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3.5rem;
  height: 3.5rem;
  margin: -1.75rem 0 0 -1.75rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #f7f2a1, #f0823c);
  box-shadow: 0 0 32px rgba(240, 130, 60, 0.45);
}
```

## Settings

Official section: <https://animejs.com/documentation/animatable/animatable-settings/>

Animatable settings can live at two levels:

- Global settings apply to every animatable property unless a property overrides them.
- Per-property settings live inside that property's object.

```javascript
createAnimatable('.card', {
  x: {
    unit: 'rem',
    duration: 220,
    ease: 'outExpo',
  },
  y: {
    duration: 420,
  },
  rotate: {
    unit: 'deg',
    modifier: value => Math.round(value / 5) * 5,
  },
  ease: 'outQuad',
});
```

### `unit`

Official subsection: <https://animejs.com/documentation/animatable/animatable-settings/unit/>

Defines the unit Anime.js appends or interprets for a property's animated values.

**Accepts:** a `String` with a valid CSS unit  
**Default:** the docs do not list a dedicated default on this page

Use this when raw numbers should be treated as something other than the property's usual unit, such as radians for rotation or `rem` for positional values.

```javascript
import { createAnimatable } from 'animejs';

const needle = createAnimatable('.unit-needle', {
  rotate: { unit: 'rad' },
  duration: 280,
});

document.querySelector('.unit-wrap').addEventListener('pointermove', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  needle.rotate(Math.atan2(y, x) + Math.PI / 2);
});
```

```html
<div class="unit-wrap">
  <div class="unit-dial">
    <div class="unit-needle"></div>
  </div>
</div>
```

```css
.unit-wrap {
  display: grid;
  place-items: center;
  width: 16rem;
  height: 16rem;
  margin: 2rem auto;
}

.unit-dial {
  position: relative;
  width: 10rem;
  height: 10rem;
  border: 0.4rem solid #17324d;
  border-radius: 50%;
  background: #f6fbff;
}

.unit-needle {
  position: absolute;
  left: 50%;
  bottom: 50%;
  width: 0.35rem;
  height: 4rem;
  margin-left: -0.175rem;
  transform-origin: center bottom;
  border-radius: 999px;
  background: #f05a28;
}
```

### `duration`

Official subsection: <https://animejs.com/documentation/animatable/animatable-settings/duration/>

Controls how long the transition takes when a property is updated through its setter.

**Accepts:**

- a `Number` greater than or equal to `0`
- a function-based value that returns a non-negative `Number`

**Default:** `1000`

A zero-duration property behaves like an immediate set, while longer durations create a trailing response.

```javascript
import { createAnimatable, utils, stagger } from 'animejs';

const swarm = createAnimatable('.duration-dot', {
  x: 0,
  y: stagger(140, { from: 'center', start: 160 }),
  ease: 'out(4)',
});

document.querySelector('.duration-stage').addEventListener('pointermove', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const x = utils.clamp(event.clientX - rect.left - halfW, -halfW + 16, halfW - 16);
  const y = utils.clamp(event.clientY - rect.top - halfH, -halfH + 16, halfH - 16);

  swarm.x(x).y(y);
});
```

```html
<div class="duration-stage">
  <div class="duration-dot"></div>
  <div class="duration-dot"></div>
  <div class="duration-dot"></div>
  <div class="duration-dot"></div>
  <div class="duration-dot"></div>
</div>
```

```css
.duration-stage {
  display: flex;
  justify-content: center;
  gap: 1rem;
  width: min(32rem, 92vw);
  height: 14rem;
  margin: 2rem auto;
  border-radius: 1rem;
  background: #08131d;
}

.duration-dot {
  width: 1rem;
  height: 1rem;
  margin-top: 6.5rem;
  border-radius: 50%;
  background: #8bf18b;
}
```

### `ease`

Official subsection: <https://animejs.com/documentation/animatable/animatable-settings/ease/>

Chooses the easing curve applied while a property moves toward its new value.

**Accepts:** Anime.js `ease` values  
**Default:** `'outQuad'`

The docs specifically recommend favoring `out`-style easing for this API because the response is usually easier to notice during interaction.

```javascript
import { createAnimatable } from 'animejs';

const linearHand = createAnimatable('.ease-needle.linear', {
  rotate: { unit: 'rad' },
  ease: 'linear',
});

const springyHand = createAnimatable('.ease-needle.springy', {
  rotate: { unit: 'rad' },
  ease: 'outElastic',
});

document.querySelector('.ease-board').addEventListener('pointermove', event => {
  for (const hand of [linearHand, springyHand]) {
    const [target] = hand.targets;
    const rect = target.parentElement.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    hand.rotate(Math.atan2(y, x) + Math.PI / 2);
  }
});
```

```html
<div class="ease-board">
  <div class="ease-clock">
    <div class="ease-needle linear"></div>
    <span>linear</span>
  </div>
  <div class="ease-clock">
    <div class="ease-needle springy"></div>
    <span>outElastic</span>
  </div>
</div>
```

```css
.ease-board {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 2rem auto;
}

.ease-clock {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.ease-clock::before {
  content: '';
  display: block;
  width: 8rem;
  height: 8rem;
  border: 0.35rem solid #17324d;
  border-radius: 50%;
  background: #f8fbfd;
}

.ease-clock {
  position: relative;
  width: 8rem;
}

.ease-needle {
  position: absolute;
  top: 1rem;
  left: 50%;
  width: 0.3rem;
  height: 3rem;
  margin-left: -0.15rem;
  transform-origin: center 3rem;
  border-radius: 999px;
  background: #ef6c3f;
}
```

### `modifier`

Official subsection: <https://animejs.com/documentation/animatable/animatable-settings/modifier/>

Runs a modifier function against the computed numeric value before Anime.js applies it.

**Accepts:** modifier function  
**Default:** `noop`

This is useful when you want values to snap, invert, clamp, or otherwise change shape without rewriting your input logic.

```javascript
import { createAnimatable, utils } from 'animejs';

const snapped = createAnimatable('.modifier-needle.snapped', {
  rotate: { unit: 'rad' },
  modifier: utils.snap(Math.PI / 8),
  duration: 0,
});

const mirrored = createAnimatable('.modifier-needle.mirrored', {
  rotate: { unit: 'rad' },
  modifier: value => -value,
  duration: 0,
});

document.querySelector('.modifier-board').addEventListener('pointermove', event => {
  for (const hand of [snapped, mirrored]) {
    const [target] = hand.targets;
    const rect = target.parentElement.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    hand.rotate(Math.atan2(y, x) + Math.PI / 2);
  }
});
```

```html
<div class="modifier-board">
  <div class="modifier-clock">
    <div class="modifier-needle snapped"></div>
    <span>snapped</span>
  </div>
  <div class="modifier-clock">
    <div class="modifier-needle mirrored"></div>
    <span>mirrored</span>
  </div>
</div>
```

```css
.modifier-board {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin: 2rem auto;
}

.modifier-clock {
  position: relative;
  width: 8rem;
  display: grid;
  justify-items: center;
  gap: 0.75rem;
}

.modifier-clock::before {
  content: '';
  display: block;
  width: 8rem;
  height: 8rem;
  border-radius: 50%;
  background: #eef5f9;
  border: 0.35rem solid #29485f;
}

.modifier-needle {
  position: absolute;
  top: 1rem;
  left: 50%;
  width: 0.3rem;
  height: 3rem;
  margin-left: -0.15rem;
  transform-origin: center 3rem;
  border-radius: 999px;
  background: #2a7f62;
}
```

## Methods

Official section: <https://animejs.com/documentation/animatable/animatable-methods/>

Each property declared in `parameters` becomes a method on the returned animatable object. Those property methods operate in two modes:

- no arguments: getter mode
- one or more arguments: setter mode

The animatable object also exposes `revert()` for teardown and cleanup.

### Getters

Official subsection: <https://animejs.com/documentation/animatable/animatable-methods/getters/>

Calling a property method with no arguments reads the current value.

**Returns:**

- `Number` for single-value properties
- `Array<Number>` for multi-value properties such as RGB-like values

```javascript
import { createAnimatable, utils } from 'animejs';

const readout = {
  x: document.querySelector('[data-x]'),
  y: document.querySelector('[data-y]'),
};

const badge = createAnimatable('.getter-badge', {
  x: 260,
  y: 260,
  ease: 'out(2)',
});

badge.animations.x.onRender = () => {
  readout.x.textContent = utils.roundPad(badge.x(), 1);
  readout.y.textContent = utils.roundPad(badge.y(), 1);
};

document.querySelector('.getter-stage').addEventListener('pointermove', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  badge.x(x).y(y);
});
```

```html
<div class="getter-stage">
  <div class="getter-stats">
    <strong>x:</strong> <span data-x>0.0</span>
    <strong>y:</strong> <span data-y>0.0</span>
  </div>
  <div class="getter-badge"></div>
</div>
```

```css
.getter-stage {
  position: relative;
  width: min(28rem, 92vw);
  height: 14rem;
  margin: 2rem auto;
  border-radius: 1rem;
  background: #101c29;
  color: #e7f1f8;
}

.getter-stats {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  font-family: monospace;
}

.getter-badge {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.5rem;
  height: 2.5rem;
  margin: -1.25rem 0 0 -1.25rem;
  border-radius: 50%;
  background: #f3c04d;
}
```

### Setters

Official subsection: <https://animejs.com/documentation/animatable/animatable-methods/setters/>

Calling a property method with at least one argument updates the property and returns the same animatable instance, so chained calls work naturally.

```javascript
animatable.property(value, duration, easing);
```

#### Parameters

| Name | Type | Description |
|------|------|-------------|
| `value` | `Number` or `Array<Number>` | Next value to animate toward |
| `duration` | `Number` (optional) | Override transition duration in milliseconds |
| `easing` | Anime.js `ease` (optional) | Override easing for this call |

#### Returns

`Animatable`

That return value enables chained updates:

```javascript
animatable.x(100).y(200);
```

```javascript
import { createAnimatable, utils } from 'animejs';

const chip = createAnimatable('.setter-chip', {
  x: 0,
  y: 0,
  backgroundColor: 0,
  ease: 'outExpo',
});

const tint = [42, 133, 255];

chip.x(0, 320, 'out(2)');
chip.y(0, 420, 'out(4)');
chip.backgroundColor(tint, 180);

document.querySelector('.setter-stage').addEventListener('pointermove', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const x = utils.clamp(event.clientX - rect.left - halfW, -halfW + 24, halfW - 24);
  const y = utils.clamp(event.clientY - rect.top - halfH, -halfH + 24, halfH - 24);

  tint[0] = utils.mapRange(x, -halfW, halfW, 42, 255);
  tint[1] = utils.mapRange(y, -halfH, halfH, 133, 72);

  chip.x(x).y(y).backgroundColor(tint);
});
```

```html
<div class="setter-stage">
  <div class="setter-chip"></div>
</div>
```

```css
.setter-stage {
  position: relative;
  width: min(30rem, 92vw);
  height: 14rem;
  margin: 2rem auto;
  border-radius: 1rem;
  background: linear-gradient(180deg, #f3f8fb, #dce9f3);
}

.setter-chip {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3rem;
  height: 3rem;
  margin: -1.5rem 0 0 -1.5rem;
  border-radius: 0.9rem;
  background: rgb(42, 133, 255);
}
```

### `revert()`

Official subsection: <https://animejs.com/documentation/animatable/animatable-methods/revert/>

`revert()` restores every tracked property to its starting value and removes inline styles created by the animatable. It is the cleanup path to use when you want the interaction fully torn down.

**Returns:** `Animatable`

Because it returns the instance, it can still participate in chains, although most code uses it as a terminal cleanup call.

```javascript
import { createAnimatable, stagger, utils } from 'animejs';

const stage = document.querySelector('.revert-stage');
const stopButton = document.querySelector('.revert-button');

const trail = createAnimatable('.revert-dot', {
  x: stagger(36, { from: 'center', start: 72 }),
  y: stagger(120, { from: 'center', start: 180 }),
  ease: 'out(4)',
});

function follow(event) {
  const rect = stage.getBoundingClientRect();
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  const x = utils.clamp(event.clientX - rect.left - halfW, -halfW + 18, halfW - 18);
  const y = utils.clamp(event.clientY - rect.top - halfH, -halfH + 18, halfH - 18);

  trail.x(x).y(y);
}

function destroyTrail() {
  stage.removeEventListener('pointermove', follow);
  trail.revert();
}

stage.addEventListener('pointermove', follow);
stopButton.addEventListener('click', destroyTrail);
```

```html
<div class="revert-stage">
  <div class="revert-dot"></div>
  <div class="revert-dot"></div>
  <div class="revert-dot"></div>
  <div class="revert-dot"></div>
  <div class="revert-dot"></div>
</div>
<button class="revert-button" type="button">Revert animatable</button>
```

```css
.revert-stage {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  width: min(30rem, 92vw);
  height: 12rem;
  margin: 2rem auto 1rem;
  border-radius: 1rem;
  background: #0f1824;
}

.revert-dot {
  width: 1.1rem;
  height: 1.1rem;
  margin-top: 5.4rem;
  border-radius: 50%;
  background: #ff8f6b;
}

.revert-button {
  display: block;
  margin: 0 auto;
  padding: 0.7rem 1rem;
}
```

## Properties

Official section: <https://animejs.com/documentation/animatable/animatable-properties/>

The docs list two instance properties on `Animatable`:

| Property | Description |
|----------|-------------|
| `targets` | Array of resolved targets controlled by the animatable |
| `animations` | Object containing the generated animation entries for each animatable property |

```javascript
import { createAnimatable } from 'animejs';

const card = createAnimatable('.property-card', {
  x: 240,
  rotate: { unit: 'deg', duration: 220 },
});

console.log(card.targets); // resolved DOM nodes
console.log(card.animations.rotate); // per-property animation object

card.animations.rotate.onRender = () => {
  document.querySelector('.property-status').textContent = `rotate: ${card.rotate().toFixed(1)}deg`;
};

card.rotate(18);
```

```html
<div class="property-demo">
  <div class="property-card"></div>
  <p class="property-status">rotate: 0.0deg</p>
</div>
```

```css
.property-demo {
  display: grid;
  justify-items: center;
  gap: 1rem;
  margin: 2rem auto;
}

.property-card {
  width: 5rem;
  height: 5rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #7fd2ff, #1d6ea3);
}
```

## Coverage checklist

This companion covers every official section and subsection linked from the Anime.js Animatable page:

- overview, imports, constructor parameters, and return value
- Settings hub
- `unit`
- `duration`
- `ease`
- `modifier`
- Methods hub
- Getters
- Setters
- `revert()`
- Properties
