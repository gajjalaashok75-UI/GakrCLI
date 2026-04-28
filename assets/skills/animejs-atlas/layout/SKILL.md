---
name: animejs-layout
description: Anime.js Layout reference covering usage patterns, settings, state parameters, methods, layout ids, callbacks, properties, and gotchas. Use when animating DOM reflow, layout transitions, display changes, or parent swaps.
---

# Layout Module

Anime.js `Layout` is the package feature for animating DOM reflow and view-state changes that CSS alone cannot tween cleanly, such as `display` switches, flex/grid rearrangement, DOM reordering, parent swaps, and cross-root handoffs via matching layout ids.

## Official Reference

- Main page: <https://animejs.com/documentation/layout/>
- Usage: <https://animejs.com/documentation/layout/usage/>
- Settings: <https://animejs.com/documentation/layout/layout-settings/>
- States parameters: <https://animejs.com/documentation/layout/states-parameters/>
- Methods: <https://animejs.com/documentation/layout/layout-methods/>
- Layout id attribute: <https://animejs.com/documentation/layout/layout-id-attribute/>
- Callbacks: <https://animejs.com/documentation/layout/layout-callbacks/>
- Properties: <https://animejs.com/documentation/layout/layout-properties/>
- Common gotchas: <https://animejs.com/documentation/layout/common-auto-layout-gotchas/>

## Official section map

| Group | Subsection | Official URL |
|---|---|---|
| Usage | `Specifying a root` | <https://animejs.com/documentation/layout/usage/specifying-a-root/> |
| Usage | `CSS display property animation` | <https://animejs.com/documentation/layout/usage/css-display-property-animation/> |
| Usage | `Staggered layout animation` | <https://animejs.com/documentation/layout/usage/staggered-layout-animation/> |
| Usage | `DOM order change animation` | <https://animejs.com/documentation/layout/usage/dom-order-change-animation/> |
| Usage | `Enter layout animation` | <https://animejs.com/documentation/layout/usage/enter-layout-animation/> |
| Usage | `Exit layout animation` | <https://animejs.com/documentation/layout/usage/exit-layout-animation/> |
| Usage | `Swap parent animation` | <https://animejs.com/documentation/layout/usage/swap-parent-animation/> |
| Usage | `Modal dialog animation` | <https://animejs.com/documentation/layout/usage/animate-modal-dialog/> |
| Settings | `children` | <https://animejs.com/documentation/layout/layout-settings/children/> |
| Settings | `delay` | <https://animejs.com/documentation/layout/layout-settings/delay/> |
| Settings | `duration` | <https://animejs.com/documentation/layout/layout-settings/duration/> |
| Settings | `ease` | <https://animejs.com/documentation/layout/layout-settings/ease/> |
| Settings | `properties` | <https://animejs.com/documentation/layout/layout-settings/properties/> |
| States | `enterFrom` | <https://animejs.com/documentation/layout/states-parameters/enterFrom/> |
| States | `leaveTo` | <https://animejs.com/documentation/layout/states-parameters/leaveTo/> |
| States | `swapAt` | <https://animejs.com/documentation/layout/states-parameters/swapAt/> |
| Methods | `record()` | <https://animejs.com/documentation/layout/layout-methods/record/> |
| Methods | `animate()` | <https://animejs.com/documentation/layout/layout-methods/animate/> |
| Methods | `update()` | <https://animejs.com/documentation/layout/layout-methods/update/> |
| Methods | `revert()` | <https://animejs.com/documentation/layout/layout-methods/revert/> |
| Layout Id | `layout id attribute` | <https://animejs.com/documentation/layout/layout-id-attribute/> |
| Callbacks | `layout callbacks` | <https://animejs.com/documentation/layout/layout-callbacks/> |
| Properties | `layout properties` | <https://animejs.com/documentation/layout/layout-properties/> |
| Gotchas | `common auto layout gotchas` | <https://animejs.com/documentation/layout/common-auto-layout-gotchas/> |

---

## Creating A Layout

Create a layout instance from the main package:

```javascript
import { createLayout } from 'animejs';

const layout = createLayout(root, parameters);
```

Or import the layout-only entry:

```javascript
import { createLayout } from 'animejs/layout';
```

### Parameters

| Name | Accepts |
|---|---|
| `root` | CSS selector or DOM element |
| `parameters` | Optional object made from layout settings, state parameters, and timeline callbacks |

### Returns

`AutoLayout`

The returned object exposes methods like `record()`, `animate()`, `update()`, and `revert()`, plus runtime arrays such as `entering`, `leaving`, and `swapping`.

### Fresh Starter Example

```javascript
import { createLayout, stagger } from 'animejs';

const layout = createLayout('.gallery', {
  duration: 700,
  delay: stagger(60),
});

document.querySelector('.toggle-view').addEventListener('click', () => {
  layout.update(({ root }) => {
    root.classList.toggle('is-grid');
  });
});
```

```html
<button class="toggle-view">Toggle view</button>
<section class="gallery">
  <article class="card">A</article>
  <article class="card">B</article>
  <article class="card">C</article>
</section>
```

```css
.gallery {
  display: flex;
  gap: 1rem;
}

.gallery.is-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card {
  min-height: 5rem;
  padding: 1rem;
  border-radius: 1rem;
  background: #dbeafe;
}
```

---

## Usage

Anime.js documents two core ways to run a layout transition:

### Manual Snapshot Flow

Use this when you want explicit control over when measurement happens.

```javascript
const layout = createLayout(rootEl);

layout.record();
rootEl.classList.toggle('is-row');
layout.animate();
```

### One-Call Update Flow

Use this when your DOM changes can safely happen inside a callback.

```javascript
const layout = createLayout(rootEl);

layout.update(({ root }) => {
  root.classList.toggle('is-row');
});
```

Anime.js notes that some frameworks may not cooperate with `update()`; if that happens, fall back to `record()` plus `animate()`.

### `Specifying a root`

- Official subsection: <https://animejs.com/documentation/layout/usage/specifying-a-root/>
- The root is required.
- It defines the measurement boundary for the layout and scopes `children` selectors to its descendants.
- By default, everything under the root is eligible unless `children` narrows the targets.
- Cross-root transitions are still possible when matching `data-layout-id` values are involved.

```javascript
import { createLayout } from 'animejs';

const sidebarLayout = createLayout(document.querySelector('.sidebar-list'));
const boardLayout = createLayout('.board-list');

document.querySelector('.flip-side').addEventListener('click', () => {
  sidebarLayout.update(({ root }) => root.classList.toggle('stacked'));
  boardLayout.update(({ root }) => root.classList.toggle('stacked'));
});
```

```html
<button class="flip-side">Flip both roots</button>
<div class="sidebar-list card-strip">
  <div class="item">Left 1</div>
  <div class="item">Left 2</div>
</div>
<div class="board-list card-strip">
  <div class="item">Right 1</div>
  <div class="item">Right 2</div>
</div>
```

### `CSS display property animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/css-display-property-animation/>
- Layout can bridge between `flex`, `grid`, and hidden states like `display: none`.
- Hidden children can use custom `enterFrom` and `leaveTo` state styling.

```javascript
import { createLayout, stagger } from 'animejs';

const views = ['mode-row', 'mode-grid', 'mode-hidden', 'mode-column'];
const layout = createLayout('.display-demo', {
  leaveTo: {
    transform: 'scale(.6)',
    opacity: 0,
    delay: stagger(50),
  },
});

let index = 0;

document.querySelector('.cycle-display').addEventListener('click', () => {
  layout.update(({ root }) => {
    root.classList.remove(views[index]);
    index = (index + 1) % views.length;
    root.classList.add(views[index]);
  });
});
```

```html
<button class="cycle-display">Cycle layout</button>
<div class="display-demo mode-row">
  <div class="item">One</div>
  <div class="item">Two</div>
  <div class="item">Three</div>
</div>
```

```css
.display-demo {
  gap: 0.75rem;
}

.display-demo.mode-row {
  display: flex;
}

.display-demo.mode-column {
  display: flex;
  flex-direction: column;
}

.display-demo.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.display-demo.mode-hidden .item {
  display: none;
}
```

### `Staggered layout animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/staggered-layout-animation/>
- `delay` can use `stagger()` so each child starts slightly later.
- The docs show changing the `from` origin depending on the active layout state.

```javascript
import { createLayout, stagger } from 'animejs';

const root = document.querySelector('.stagger-demo');
const layout = createLayout(root, { ease: 'outExpo' });

document.querySelector('.stagger-layout').addEventListener('click', () => {
  layout.update(() => {
    root.classList.toggle('is-column');
  }, {
    delay: stagger(70, {
      from: root.classList.contains('is-column') ? 'last' : 'first',
    }),
  });
});
```

```html
<button class="stagger-layout">Stagger transition</button>
<div class="stagger-demo">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
  <div class="item">D</div>
</div>
```

```css
.stagger-demo {
  display: flex;
  gap: 0.75rem;
}

.stagger-demo.is-column {
  flex-direction: column;
}
```

### `DOM order change animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/dom-order-change-animation/>
- Re-appending or reshuffling children is enough; Layout measures before and after and animates the movement.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.shuffle-demo');

document.querySelector('.shuffle-items').addEventListener('click', () => {
  layout.update(({ root }) => {
    const items = [...root.querySelectorAll('.item')];
    items.sort(() => Math.random() - 0.5);
    items.forEach(item => root.appendChild(item));
  });
});
```

```html
<button class="shuffle-items">Shuffle</button>
<div class="shuffle-demo">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
  <div class="item">D</div>
</div>
```

### `Enter layout animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/enter-layout-animation/>
- Entering items include newly appended nodes and nodes becoming visible again.
- The documented default for `enterFrom` is `{ opacity: 0 }`.

```javascript
import { createLayout } from 'animejs';

let count = 0;

const layout = createLayout('.enter-demo', {
  duration: 250,
  ease: 'outQuad',
  enterFrom: {
    transform: 'translateY(40px) scale(.8)',
    opacity: 0,
    duration: 400,
    ease: 'out(3)',
  },
});

document.querySelector('.add-tile').addEventListener('click', () => {
  layout.update(({ root }) => {
    const tile = document.createElement('div');
    tile.className = 'item';
    tile.textContent = `Item ${++count}`;
    root.appendChild(tile);
  });
});
```

```html
<button class="add-tile">Add item</button>
<div class="enter-demo"></div>
```

### `Exit layout animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/exit-layout-animation/>
- Leaving items include nodes switched to `display: none` or `visibility: hidden`.
- The docs remove the leaving nodes after the timeline resolves.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.exit-demo', {
  duration: 250,
  ease: 'outQuad',
  leaveTo: {
    transform: 'translateY(-40px) scale(.8)',
    opacity: 0,
    duration: 350,
    ease: 'out(3)',
  },
});

document.querySelector('.remove-tile').addEventListener('click', () => {
  layout.update(({ root }) => {
    const item = root.querySelector('.item:not(.is-hidden)');
    if (item) item.classList.add('is-hidden');
  }).then(() => {
    layout.leaving.forEach(node => node.remove());
  });
});
```

```html
<button class="remove-tile">Remove item</button>
<div class="exit-demo">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

```css
.exit-demo .is-hidden {
  display: none;
}
```

### `Swap parent animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/swap-parent-animation/>
- Moving a child from one container to another is supported as long as the overall layout root can measure both parents.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.swap-demo');

document.querySelector('.swap-parent').addEventListener('click', () => {
  layout.update(({ root }) => {
    const child = root.querySelector('.item');
    const current = child.parentElement;
    const next = current.nextElementSibling || current.previousElementSibling;

    current.style.zIndex = '0';
    next.style.zIndex = '1';
    next.appendChild(child);
  });
});
```

```html
<button class="swap-parent">Swap parent</button>
<div class="swap-demo">
  <div class="slot slot-a">
    <div class="item">Item A</div>
  </div>
  <div class="slot slot-b"></div>
</div>
```

```css
.swap-demo {
  display: flex;
  gap: 1rem;
}

.slot {
  position: relative;
  flex: 1;
  min-height: 7rem;
  padding: 0.75rem;
  border: 1px dashed #94a3b8;
}

.slot-b {
  flex: 2;
}
```

### `Modal dialog animation`

- Official subsection: <https://animejs.com/documentation/layout/usage/animate-modal-dialog/>
- This pattern combines a dialog root, explicit `children`, and matching `data-layout-id` values so a button can expand into a modal clone.
- The docs also animate a CSS custom property for the overlay.

```javascript
import { createLayout } from 'animejs';

const cards = [...document.querySelectorAll('.modal-grid .item')];
const dialog = document.querySelector('.card-dialog');

const modalLayout = createLayout(dialog, {
  children: ['.item', 'h2', 'p'],
  properties: ['--overlay-alpha'],
});

function openCard(card) {
  const clone = card.cloneNode(true);
  dialog.innerHTML = '';
  dialog.appendChild(clone);

  modalLayout.update(() => {
    dialog.showModal();
    card.classList.add('is-open');
  }, {
    duration: Number(card.dataset.duration || 700),
  });
}

function closeCard() {
  let origin;

  modalLayout.update(() => {
    dialog.close();
    origin = cards.find(card => card.classList.contains('is-open'));
    if (origin) origin.classList.remove('is-open');
  }).then(() => {
    if (origin) origin.focus();
  });
}

cards.forEach(card => {
  card.addEventListener('click', () => openCard(card));
});

dialog.addEventListener('cancel', closeCard);
dialog.addEventListener('click', closeCard);
```

```html
<div class="modal-grid">
  <button class="item" data-layout-id="card-a" data-duration="500">
    <h2 data-layout-id="card-a-title">Card A</h2>
    <p data-layout-id="card-a-copy">Short copy for the expanded card.</p>
  </button>
  <button class="item" data-layout-id="card-b" data-duration="900">
    <h2 data-layout-id="card-b-title">Card B</h2>
    <p data-layout-id="card-b-copy">Another block of modal content.</p>
  </button>
</div>

<dialog class="card-dialog"></dialog>
```

```css
.card-dialog {
  --overlay-alpha: 100%;
  width: 100vw;
  height: 100dvh;
  border: 0;
  background: color-mix(in srgb, black, transparent var(--overlay-alpha));
}

.card-dialog[open] {
  --overlay-alpha: 40%;
}

.modal-grid .item.is-open {
  visibility: hidden;
}

.card-dialog .item {
  width: min(32rem, 92vw);
  padding: 1.5rem;
  border-radius: 1rem;
  background: white;
}
```

---

## Settings

Settings live directly on the second `createLayout()` argument.

```javascript
import { createLayout } from 'animejs';

createLayout('.layout-root', {
  children: '.card',
  delay: 0,
  duration: 350,
  ease: 'inOut(3.5)',
  properties: ['boxShadow'],
});
```

### `children`

- Official subsection: <https://animejs.com/documentation/layout/layout-settings/children/>
- Accepts: CSS selector, DOM element, `NodeList`, or `Array<DOMTargetSelector>`
- Default: `'*'`
- This narrows which descendants get measured and animated.
- Descendants inside matched targets but not matched themselves are effectively frozen and switch at mid-transition.
- This is useful for reducing noisy text reflow and for matching external nodes via layout ids.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.children-demo', {
  children: '.card',
  duration: 900,
});

document.querySelector('.children-toggle').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'), {
    swapAt: { opacity: 1 },
  });
});
```

```html
<button class="children-toggle">Toggle children targets</button>
<div class="children-demo">
  <div class="card"><p>Only the card is targeted.</p></div>
  <div class="card"><p>The paragraph swaps with it.</p></div>
</div>
```

### `delay`

- Official subsection: <https://animejs.com/documentation/layout/layout-settings/delay/>
- Accepts: non-negative `Number`, or a function returning a non-negative number
- Default: `0`
- Works with `stagger()`
- You can override it per transition in `animate()` or `update()`.

```javascript
import { createLayout, stagger } from 'animejs';

const layout = createLayout('.delay-demo', {
  delay: 300,
});

document.querySelector('.delay-a').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'));
});

document.querySelector('.delay-b').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'), {
    delay: stagger(80),
  });
});
```

```html
<button class="delay-a">Default delay</button>
<button class="delay-b">Stagger delay</button>
<div class="delay-demo">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

### `duration`

- Official subsection: <https://animejs.com/documentation/layout/layout-settings/duration/>
- Accepts: non-negative `Number`, or a function returning one
- Default: `350`
- Works with `stagger()`
- It defines the baseline transition length for layout-managed nodes.

```javascript
import { createLayout } from 'animejs';

const fast = createLayout('.duration-fast');
const slow = createLayout('.duration-slow', { duration: 1000 });

document.querySelector('.compare-duration').addEventListener('click', () => {
  fast.update(({ root }) => root.classList.toggle('is-row'));
  slow.update(({ root }) => root.classList.toggle('is-row'));
});
```

```html
<button class="compare-duration">Compare durations</button>
<div class="duration-fast"><div class="item">350ms</div><div class="item">default</div></div>
<div class="duration-slow"><div class="item">1000ms</div><div class="item">custom</div></div>
```

### `ease`

- Official subsection: <https://animejs.com/documentation/layout/layout-settings/ease/>
- Accepts: easing function, built-in easing string, or a function returning either
- Default: `'inOut(3.5)'`
- Applies to the layout transition unless overridden per run or per state.

```javascript
import { createLayout, spring } from 'animejs';

const layout = createLayout('.ease-demo', {
  ease: 'outExpo',
});

document.querySelector('.ease-default').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'));
});

document.querySelector('.ease-spring').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'), {
    ease: spring(),
  });
});
```

```html
<button class="ease-default">String ease</button>
<button class="ease-spring">Spring override</button>
<div class="ease-demo">
  <div class="item">Ease</div>
  <div class="item">Demo</div>
</div>
```

### `properties`

- Official subsection: <https://animejs.com/documentation/layout/layout-settings/properties/>
- Accepts: array of CSS property names, including custom properties like `'--overlay-alpha'`
- Default:

```javascript
[
  'opacity',
  'fontSize',
  'color',
  'backgroundColor',
  'borderRadius',
  'border',
  'filter',
  'clipPath',
]
```

- Position and size are always handled internally.
- Use this to add extra interpolated properties such as `boxShadow` or CSS variables.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.properties-demo', {
  duration: 800,
  properties: ['boxShadow', '--card-hue'],
});

document.querySelector('.properties-toggle').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'));
});
```

```html
<button class="properties-toggle">Animate extra props</button>
<div class="properties-demo">
  <div class="item">Shadow</div>
  <div class="item">Variable</div>
</div>
```

```css
.properties-demo .item {
  --card-hue: 200;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  background: hsl(var(--card-hue) 70% 88%);
}

.properties-demo.is-row .item {
  --card-hue: 150;
  box-shadow: 0 20px 30px rgba(15, 23, 42, 0.24);
}
```

---

## States Parameters

Anime.js groups transition-state styling into three parameter objects:

- `enterFrom` for incoming nodes
- `leaveTo` for outgoing nodes
- `swapAt` for frozen descendants and swap-only nodes

Shared rules from the docs:

- Each state object accepts CSS property entries plus optional `delay`, `duration`, and `ease`
- Any valid CSS property is allowed
- CSS transform shorthands are not supported in these state objects
- Use `transform: 'translate(...) scale(...)'` instead of shorthand keys like `x`, `y`, `scale`, or `rotate`

After `layout.animate()` or `layout.update()` runs, Anime.js also exposes:

- `layout.entering`
- `layout.leaving`
- `layout.swapping`

Those arrays are cleared and rebuilt on every transition.

### `enterFrom`

- Official subsection: <https://animejs.com/documentation/layout/states-parameters/enterFrom/>
- Accepts:
  - CSS properties as `Number | String | Function`
  - `delay: Number | Function`
  - `duration: Number | Function`
  - `ease: String | Function`
- Default: `{ opacity: 0 }`
- A node counts as entering when it is newly appended or switches from hidden to visible.

```javascript
import { createLayout } from 'animejs';

let noteCount = 0;

const layout = createLayout('.enter-state-demo', {
  enterFrom: {
    transform: 'translateY(32px) scale(.7)',
    opacity: 0,
    duration: 420,
    ease: 'out(3)',
  },
});

document.querySelector('.enter-state-add').addEventListener('click', () => {
  layout.update(({ root }) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.textContent = `Note ${++noteCount}`;
    root.appendChild(item);
  });
});
```

```html
<button class="enter-state-add">Add note</button>
<div class="enter-state-demo"></div>
```

### `leaveTo`

- Official subsection: <https://animejs.com/documentation/layout/states-parameters/leaveTo/>
- Accepts:
  - CSS properties as `Number | String | Function`
  - `delay: Number | Function`
  - `duration: Number | Function`
  - `ease: String | Function`
- Default: `{ opacity: 0 }`
- A node counts as leaving when it switches to `display: none` or `visibility: hidden`.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.leave-state-demo', {
  leaveTo: {
    transform: 'translateY(-32px) scale(.7)',
    opacity: 0,
    duration: 360,
    ease: 'out(3)',
  },
});

document.querySelector('.leave-state-hide').addEventListener('click', () => {
  layout.update(({ root }) => {
    const firstVisible = root.querySelector('.item:not(.is-hidden)');
    if (firstVisible) firstVisible.classList.add('is-hidden');
  });
});
```

```html
<button class="leave-state-hide">Hide first</button>
<div class="leave-state-demo">
  <div class="item">A</div>
  <div class="item">B</div>
  <div class="item">C</div>
</div>
```

```css
.leave-state-demo .is-hidden {
  display: none;
}
```

### `swapAt`

- Official subsection: <https://animejs.com/documentation/layout/states-parameters/swapAt>
- Accepts:
  - CSS properties as `Number | String | Function`
  - `delay: Number | Function`
  - `duration: Number | Function`
  - `ease: String | Function`
- Default: `{ opacity: 0, ease: 'inOut(1.75)' }`
- This applies halfway through the transition to descendants that are not fully animated themselves.
- The docs describe it as a midpoint state: the node interpolates to the swap values near 50% progress and then comes back to its computed destination state.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.swap-state-demo', {
  children: '.card',
});

document.querySelector('.swap-state-toggle').addEventListener('click', () => {
  layout.update(({ root }) => root.classList.toggle('is-row'), {
    swapAt: {
      opacity: 0,
      filter: 'blur(3px)',
    },
  });
});
```

```html
<button class="swap-state-toggle">Swap descendants</button>
<div class="swap-state-demo">
  <div class="card"><p>Frozen child A</p></div>
  <div class="card"><p>Frozen child B</p></div>
</div>
```

---

## Methods

### `record()`

- Official subsection: <https://animejs.com/documentation/layout/layout-methods/record/>
- Returns: `AutoLayout`
- Saves the current measurements to become the starting state for the next `animate()` call.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.record-demo');

document.querySelector('.record-run').addEventListener('click', () => {
  layout.record();
  const first = layout.root.firstElementChild;
  if (first) layout.root.append(first);
  layout.animate();
});
```

```html
<button class="record-run">record() then animate()</button>
<div class="record-demo">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

### `animate(overrides?)`

- Official subsection: <https://animejs.com/documentation/layout/layout-methods/animate/>
- Accepts: optional animation override object
- Returns: `Timeline`
- Compares the last recorded snapshot with the latest measurements and animates the difference.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.animate-demo');

document.querySelector('.animate-run').addEventListener('click', () => {
  layout.record();
  const first = layout.root.firstElementChild;
  if (first) layout.root.append(first);
  layout.animate({
    duration: 750,
    ease: 'out(4)',
  });
});
```

```html
<button class="animate-run">animate with overrides</button>
<div class="animate-demo">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

### `update(callback, overrides?)`

- Official subsection: <https://animejs.com/documentation/layout/layout-methods/update/>
- Parameters:
  - callback function that mutates the layout state
  - optional animation override object
- Returns: `Timeline`
- Equivalent to `record()` plus callback plus `animate()`
- The docs warn that this shortcut may not work in every framework integration.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.update-demo');

document.querySelector('.update-run').addEventListener('click', () => {
  layout.update(() => {
    const first = layout.root.firstElementChild;
    if (first) layout.root.append(first);
  }, {
    duration: 750,
    ease: 'out(4)',
  });
});
```

```html
<button class="update-run">update()</button>
<div class="update-demo">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

### `revert()`

- Official subsection: <https://animejs.com/documentation/layout/layout-methods/revert/>
- Returns: `AutoLayout`
- Finishes active layout animations and restores the DOM to its current real state.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.revert-demo', {
  duration: 5000,
  ease: 'out(3)',
});

document.querySelector('.revert-play').addEventListener('click', () => {
  layout.update(() => {
    const first = layout.root.firstElementChild;
    if (first) layout.root.append(first);
  });
});

document.querySelector('.revert-stop').addEventListener('click', () => {
  layout.revert();
});
```

```html
<button class="revert-play">Animate</button>
<button class="revert-stop">Revert</button>
<div class="revert-demo">
  <div class="item">1</div>
  <div class="item">2</div>
  <div class="item">3</div>
</div>
```

---

## Layout Id Attribute

- Official section: <https://animejs.com/documentation/layout/layout-id-attribute/>
- Layout ids are auto-assigned unless you supply your own `data-layout-id`.
- When two elements share the same id and one is visible while the other is hidden, Layout can morph between them without manual cloning or moving.
- This is especially useful for modal expansions and cross-container handoffs.

### Practical Rules

- Use the same `data-layout-id` on the two logical representations of the same item.
- Keep one visible and one hidden at any given moment.
- If the destination element is outside the root at creation time, pair layout ids with an explicit `children` list.

### Fresh Example

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.layout-id-demo');
const [a, b] = document.querySelectorAll('.layout-id-demo .item');

a.dataset.layoutId = 'shared-card';
b.dataset.layoutId = 'shared-card';
b.classList.add('is-hidden');

document.querySelector('.layout-id-toggle').addEventListener('click', () => {
  layout.update(() => {
    a.classList.toggle('is-hidden');
    b.classList.toggle('is-hidden');
  });
});
```

```html
<button class="layout-id-toggle">Swap twin</button>
<div class="layout-id-demo">
  <div class="pane"><div class="item">Profile</div></div>
  <div class="pane"><div class="item">Profile</div></div>
</div>
```

```css
.layout-id-demo {
  display: flex;
  gap: 1rem;
}

.layout-id-demo .is-hidden {
  display: none;
}
```

---

## Callbacks

- Official section: <https://animejs.com/documentation/layout/layout-callbacks/>
- Layout does not introduce a custom callback API of its own.
- Instead, it forwards the full Timeline callback surface through the layout parameters and the `Timeline` returned by `animate()` and `update()`.
- Common hooks include `onBegin`, `onUpdate`, and `onComplete`.
- The returned `Timeline` also supports `.then()`.

```javascript
import { createLayout } from 'animejs';

const layout = createLayout('.callback-demo', {
  onBegin: () => console.log('layout start'),
  onUpdate: self => console.log('progress', self.currentTime),
  onComplete: () => console.log('layout end'),
});

layout.update(({ root }) => {
  root.classList.toggle('is-row');
}).then(() => {
  console.log('timeline promise resolved');
});
```

### Callback Notes

- Put the callbacks on `createLayout()` when you want global defaults.
- Pass overrides to `animate()` or `update()` when one transition needs different behavior.
- Reach for the returned `Timeline` if you want promise-style sequencing.

---

## Properties

- Official section: <https://animejs.com/documentation/layout/layout-properties/>
- The Layout docs expose one consolidated properties table.

| Property | Meaning |
|---|---|
| `params` | Original configuration object passed to `createLayout()` |
| `root` | Resolved root `HTMLElement` used for measurement |
| `children` | Selector set used to find tracked descendants on each `record()` |
| `enterFromParams` | Normalized incoming-state parameters |
| `leaveToParams` | Normalized outgoing-state parameters |
| `swapAtParams` | Normalized swap-state parameters |
| `properties` | `Set<String>` of extra CSS properties to interpolate |
| `oldState` | Previously recorded `LayoutSnapshot` collection |
| `newState` | Newly measured `LayoutSnapshot` collection |
| `timeline` | Most recent `Timeline`, or `null` if none has run |
| `animating` | Nodes animated during the latest run |
| `swapping` | Nodes treated as swap-only during the latest run |
| `entering` | Nodes entering during the latest run |
| `leaving` | Nodes leaving during the latest run |
| `id` | Incrementing numeric identifier useful for debugging |

### Snapshot Helpers

The docs call out helper methods on `layout.oldState` and `layout.newState`, including:

- `.getNode(element)`
- `.getComputedValue(element, property)`

These are useful when you want to inspect the captured measurements yourself.

### Runtime Array Timing

`layout.entering`, `layout.leaving`, and `layout.swapping` are replaced every time a transition runs. Read them immediately after `update()` or `animate()` if you need to coordinate follow-up work.

---

## Common Gotchas

- Official section: <https://animejs.com/documentation/layout/common-auto-layout-gotchas/>

### 1. Unexpected descendant fading

If you narrow `children`, descendants inside those targets may only swap halfway through the transition instead of fully animating. Anime.js may fade them out and back in when:

- they are not matched directly by `children`
- their own size changes
- their parent's size also changes

Workarounds:

- add those descendants to the `children` selector list
- or set `swapAt: { opacity: 1 }`

```javascript
const layout = createLayout('#root', {
  children: '.card',
  swapAt: { opacity: 1 },
});
```

### 2. Root position is not animated

Anime.js intentionally does not tween the root element's position because doing so can create movement bugs in surrounding siblings. Width and height can still animate.

Workaround:

- move the layout root one level higher so the element you want to reposition becomes a child instead of the root

```javascript
// Instead of:
createLayout('#container .grid');

// Use:
createLayout('#container');
```

### 3. Text reflows and appears to jump

Animating `fontSize` together with width or height can create temporary rewraps, especially in Firefox.

Workaround:

- set `white-space: nowrap` when wrapping is not needed

### 4. Inline elements next to text nodes do not move

Anime.js excludes inline neighbors of raw text nodes from position animation so text flow does not break.

Workaround:

- wrap the text nodes in spans so they can participate with the inline element

```html
<p><span>Some text</span> <span class="badge">inline</span> <span>more text</span></p>
```

### 5. Transform shorthand keys do not work in state parameters

`enterFrom`, `leaveTo`, and `swapAt` do not accept transform shorthand keys such as `scale`, `rotate`, `x`, or `y`.

Workaround:

- use a full `transform` string instead

```javascript
createLayout('#root', {
  enterFrom: {
    transform: 'scale(0)',
  },
});
```

### 6. SVG nodes are ignored

The Layout system only tracks HTML elements. SVG elements and their descendants are outside its animation model.

---

## Practical Summary

- Use `record()` plus `animate()` when you need precise control or framework compatibility.
- Use `update()` when a simple callback can safely make the DOM mutation.
- Reach for `children` to reduce noise, but remember that unmatched descendants become swap-only.
- Use `data-layout-id` for modal expansions, mirrored cards, and cross-container continuity.
- If a transition seems odd, check the gotchas first; most layout surprises come from root choice, text flow, swap-only descendants, or transform shorthand usage.
