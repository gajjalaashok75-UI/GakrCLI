---
name: animejs-draggable
description: Anime.js Draggable reference covering axes parameters, settings, callbacks, methods, and properties. Use when adding drag, snap, bounds, auto-scroll, release physics, or draggable runtime controls to DOM elements.
---

# Draggable Module

Anime.js `Draggable` adds pointer-driven dragging, snapping, bounds, auto-scroll, lifecycle hooks, and runtime controls to DOM elements.

## Official Reference

- Main page: <https://animejs.com/documentation/draggable/>
- Axes parameters: <https://animejs.com/documentation/draggable/draggable-axes-parameters/>
- Settings: <https://animejs.com/documentation/draggable/draggable-settings/>
- Callbacks: <https://animejs.com/documentation/draggable/draggable-callbacks/>
- Methods: <https://animejs.com/documentation/draggable/draggable-methods/>
- Properties: <https://animejs.com/documentation/draggable/draggable-properties/>

## Official section map

| Group | Subsection | Official URL |
|---|---|---|
| Axes | `x` | <https://animejs.com/documentation/draggable/draggable-axes-parameters/x/> |
| Axes | `y` | <https://animejs.com/documentation/draggable/draggable-axes-parameters/y/> |
| Axes | `snap` | <https://animejs.com/documentation/draggable/draggable-axes-parameters/snap/> |
| Axes | `modifier` | <https://animejs.com/documentation/draggable/draggable-axes-parameters/modifier/> |
| Axes | `mapTo` | <https://animejs.com/documentation/draggable/draggable-axes-parameters/mapto/> |
| Settings | `trigger` | <https://animejs.com/documentation/draggable/draggable-settings/trigger/> |
| Settings | `container` | <https://animejs.com/documentation/draggable/draggable-settings/container/> |
| Settings | `containerPadding` | <https://animejs.com/documentation/draggable/draggable-settings/containerpadding/> |
| Settings | `containerFriction` | <https://animejs.com/documentation/draggable/draggable-settings/containerfriction/> |
| Settings | `releaseContainerFriction` | <https://animejs.com/documentation/draggable/draggable-settings/releasecontainerfriction/> |
| Settings | `releaseMass` | <https://animejs.com/documentation/draggable/draggable-settings/releasemass/> |
| Settings | `releaseStiffness` | <https://animejs.com/documentation/draggable/draggable-settings/releasestiffness/> |
| Settings | `releaseDamping` | <https://animejs.com/documentation/draggable/draggable-settings/releasedamping/> |
| Settings | `velocityMultiplier` | <https://animejs.com/documentation/draggable/draggable-settings/velocitymultiplier/> |
| Settings | `minVelocity` | <https://animejs.com/documentation/draggable/draggable-settings/minvelocity/> |
| Settings | `maxVelocity` | <https://animejs.com/documentation/draggable/draggable-settings/maxvelocity/> |
| Settings | `releaseEase` | <https://animejs.com/documentation/draggable/draggable-settings/releaseease/> |
| Settings | `dragSpeed` | <https://animejs.com/documentation/draggable/draggable-settings/dragspeed/> |
| Settings | `dragThreshold` | <https://animejs.com/documentation/draggable/draggable-settings/dragthreshold/> |
| Settings | `scrollThreshold` | <https://animejs.com/documentation/draggable/draggable-settings/scrollthreshold/> |
| Settings | `scrollSpeed` | <https://animejs.com/documentation/draggable/draggable-settings/scrollspeed/> |
| Settings | `cursor` | <https://animejs.com/documentation/draggable/draggable-settings/cursor/> |
| Callbacks | `onGrab` | <https://animejs.com/documentation/draggable/draggable-callbacks/ongrab/> |
| Callbacks | `onDrag` | <https://animejs.com/documentation/draggable/draggable-callbacks/ondrag/> |
| Callbacks | `onUpdate` | <https://animejs.com/documentation/draggable/draggable-callbacks/onupdate/> |
| Callbacks | `onRelease` | <https://animejs.com/documentation/draggable/draggable-callbacks/onrelease/> |
| Callbacks | `onSnap` | <https://animejs.com/documentation/draggable/draggable-callbacks/onsnap/> |
| Callbacks | `onSettle` | <https://animejs.com/documentation/draggable/draggable-callbacks/onsettle/> |
| Callbacks | `onResize` | <https://animejs.com/documentation/draggable/draggable-callbacks/onresize/> |
| Callbacks | `onAfterResize` | <https://animejs.com/documentation/draggable/draggable-callbacks/onafterresize/> |
| Methods | `disable()` | <https://animejs.com/documentation/draggable/draggable-methods/disable/> |
| Methods | `enable()` | <https://animejs.com/documentation/draggable/draggable-methods/enable/> |
| Methods | `setX()` | <https://animejs.com/documentation/draggable/draggable-methods/setx/> |
| Methods | `setY()` | <https://animejs.com/documentation/draggable/draggable-methods/sety/> |
| Methods | `animateInView()` | <https://animejs.com/documentation/draggable/draggable-methods/animateinview/> |
| Methods | `scrollInView()` | <https://animejs.com/documentation/draggable/draggable-methods/scrollinview/> |
| Methods | `stop()` | <https://animejs.com/documentation/draggable/draggable-methods/stop/> |
| Methods | `reset()` | <https://animejs.com/documentation/draggable/draggable-methods/reset/> |
| Methods | `revert()` | <https://animejs.com/documentation/draggable/draggable-methods/revert/> |
| Methods | `refresh()` | <https://animejs.com/documentation/draggable/draggable-methods/refresh/> |
| Properties | `Draggable properties` | <https://animejs.com/documentation/draggable/draggable-properties/> |

---

## Creating Draggables

Create a draggable with `createDraggable()` from the main package:

```javascript
import { createDraggable } from 'animejs';

const draggable = createDraggable(target, parameters);
```

Or import the draggable-only entry:

```javascript
import { createDraggable } from 'animejs/draggable';
```

### Parameters

| Name | Accepts |
|---|---|
| `target` | CSS selector or DOM element |
| `parameters` | Optional object made of draggable axes parameters, draggable settings, and draggable callbacks |

### Returns

`Draggable`

The returned instance exposes runtime properties, callback references, and imperative methods like `setX()`, `refresh()`, and `revert()`.

### Fresh starter example

```javascript
import { createDraggable } from 'animejs';

createDraggable('.chip', {
  container: '.stage',
  x: { snap: 24 },
  y: { snap: 24 },
  releaseEase: 'out(3)',
});
```

```html
<div class="stage">
  <button class="chip">Drag me</button>
</div>
```

```css
.stage {
  position: relative;
  width: 18rem;
  height: 12rem;
  border: 1px dashed #8a8f98;
  border-radius: 1rem;
}

.chip {
  width: 5rem;
  height: 3rem;
  border: 0;
  border-radius: 0.9rem;
  background: #1f2937;
  color: #fff;
}
```

---

## Axes Parameters

Axes options can be attached globally at the root of the parameter object, or scoped to one axis by nesting them in `x` or `y`.

### `x`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-axes-parameters/x/>
- Accepts: `Boolean | Object`
- Default: `true`
- Use `false` to block horizontal dragging, or pass an object to configure the axis.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.card-free', { x: true });
createDraggable('.card-locked', { x: false, y: true });
```

```html
<div class="lane">
  <div class="card card-free">x on</div>
  <div class="card card-locked">x off</div>
</div>
```

### `y`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-axes-parameters/y/>
- Accepts: `Boolean | Object`
- Default: `true`
- Use `false` to disable vertical dragging for one target.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.token-free', { y: true });
createDraggable('.token-rail', { x: true, y: false });
```

```html
<div class="lane">
  <div class="token token-free">y on</div>
  <div class="token token-rail">y off</div>
</div>
```

### `snap`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-axes-parameters/snap/>
- Accepts: `Number | Array<Number> | (() => Number | Array<Number>)`
- Default: `0`
- A number rounds to the nearest increment. An array snaps to the closest listed stop.
- Function-returned values refresh on resize and can also be recomputed with `draggable.refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.tile', {
  container: '.snap-grid',
  snap: 32,
  x: { snap: [0, 96, 192] },
});
```

```html
<div class="snap-grid">
  <div class="tile">snap</div>
</div>
```

```css
.snap-grid {
  position: relative;
  width: 14rem;
  height: 10rem;
  background-image:
    linear-gradient(to right, rgba(0, 0, 0, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
}
```

### `modifier`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-axes-parameters/modifier/>
- Accepts: modifier function
- Default: `noop`
- Apply it globally or per axis to remap outgoing axis values before Anime.js writes them.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.dial', {
  modifier: value => Math.round(value / 10) * 10,
  x: { modifier: value => Math.max(-120, Math.min(120, value)) },
});
```

```html
<div class="dial">dial</div>
```

### `mapTo`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-axes-parameters/mapto/>
- Accepts: `String`
- Default: `null`
- Redirect one axis to a different animatable property instead of the default x/y translation.

```javascript
import { createDraggable, utils } from 'animejs';

utils.set('.panel', { z: 80 });

createDraggable('.panel', {
  x: { mapTo: 'rotateY' },
  y: { mapTo: 'z' },
});
```

```html
<div class="panel">tilt</div>
```

---

## Settings

These options live directly on the `createDraggable()` parameters object.

### `trigger`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/trigger/>
- Accepts: CSS selector or DOM element
- Use it when one element should move, but another element should be the handle.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.sheet', {
  trigger: '.sheet-handle',
});
```

```html
<section class="sheet">
  <button class="sheet-handle">Grab</button>
</section>
```

### `container`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/container/>
- Accepts: selector string, `HTMLElement`, `[top, right, bottom, left]`, or `() => [top, right, bottom, left]`
- Default: `null`
- Use an element container for visible bounds, or numeric edges for custom limits.
- Function-returned bounds refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.note-a', { container: '.board' });
createDraggable('.note-b', { container: [16, 220, 140, 32] });
```

```html
<div class="board">
  <div class="note note-a">box</div>
  <div class="note note-b">array</div>
</div>
```

```css
.board {
  position: relative;
  width: 16rem;
  height: 10rem;
  border: 1px solid #c8cdd4;
}
```

### `containerPadding`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/containerpadding/>
- Accepts: `Number | Array<Number> | (() => Array<Number>)`
- Default: `0`
- Padding is read as pixels and follows `[top, right, bottom, left]`.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.badge', {
  container: '.frame',
  containerPadding: [12, 24, 12, 40],
  scrollThreshold: 0,
});
```

```html
<div class="frame">
  <div class="badge">pad</div>
</div>
```

```css
.frame {
  position: relative;
  width: 15rem;
  height: 9rem;
  border: 1px dashed #94a3b8;
}
```

### `containerFriction`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/containerfriction/>
- Accepts: `0..1` number, or a function returning a `0..1` number
- Default: `0.8`
- `0` means no resistance outside bounds. `1` effectively keeps the dragged element from overshooting.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.soft', { container: '.playfield', containerFriction: 0 });
createDraggable('.hard', { container: '.playfield', containerFriction: 1 });
```

### `releaseContainerFriction`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/releasecontainerfriction/>
- Accepts: `0..1` number, or a function returning a `0..1` number
- Default: inherits `containerFriction`
- This only overrides the out-of-bounds resistance used after release.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.glide', {
  container: '.playfield',
  releaseContainerFriction: 0,
});

createDraggable('.clamp', {
  container: '.playfield',
  releaseContainerFriction: 1,
});
```

### `releaseMass`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/releasemass/>
- Accepts: number from `0` to `10000`
- Default: `1`
- Lower values move faster after release. This value is ignored if `releaseEase` is a spring and that spring provides its own `mass`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.feather', { container: '.arena', releaseMass: 0.25 });
createDraggable('.anvil', { container: '.arena', releaseMass: 8 });
```

### `releaseStiffness`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/releasestiffness/>
- Accepts: number from `0` to `10000`
- Default: `80`
- Lower stiffness slows the rebound. If `releaseEase` is a spring, the spring's own `stiffness` wins.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.loose', { container: '.arena', releaseStiffness: 24 });
createDraggable('.snappy', { container: '.arena', releaseStiffness: 220 });
```

### `releaseDamping`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/releasedamping/>
- Accepts: number from `0` to `10000`
- Default: `10`
- Smaller values produce more bounce near the bounds. If `releaseEase` is a spring, the spring's own `damping` replaces it.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.bouncy', { container: '.arena', releaseDamping: 4 });
createDraggable('.calm', { container: '.arena', releaseDamping: 28 });
```

### `velocityMultiplier`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/velocitymultiplier/>
- Accepts: non-negative number, or a function returning one
- Default: `1`
- `0` removes throw velocity. Higher values amplify it.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.steady', { container: '.arena', velocityMultiplier: 0 });
createDraggable('.fast', { container: '.arena', velocityMultiplier: 3 });
```

### `minVelocity`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/minvelocity/>
- Accepts: non-negative number, or a function returning one
- Default: `0`
- Sets the floor for release velocity.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.zero-floor', { container: '.arena', minVelocity: 0 });
createDraggable('.forced-flick', { container: '.arena', minVelocity: 12 });
```

### `maxVelocity`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/maxvelocity/>
- Accepts: non-negative number, or a function returning one
- Default: `50`
- Caps how strong the release throw can become.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.capped', { container: '.arena', maxVelocity: 8 });
createDraggable('.wide-open', { container: '.arena', maxVelocity: 100 });
```

### `releaseEase`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/releaseease/>
- Accepts: Anime.js `ease`
- Default: `eases.outQuint`
- Applies after release, after snapping, and when an out-of-bounds element is pulled back in.
- Passing `spring()` overrides `releaseMass`, `releaseStiffness`, and `releaseDamping`. The spring's `velocity` input is ignored in favor of live drag velocity.

```javascript
import { createDraggable, spring } from 'animejs';

createDraggable('.elastic', {
  container: '.arena',
  releaseEase: 'outElastic',
});

createDraggable('.springy', {
  container: '.arena',
  releaseEase: spring({ stiffness: 140, damping: 14 }),
});
```

### `dragSpeed`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/dragspeed/>
- Accepts: `Number | (() => Number)`
- Default: `1`
- `0` blocks motion. Values above `1` exaggerate movement. Negative values reverse the direction.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.turbo', { container: '.arena', dragSpeed: 2 });
createDraggable('.laggy', { container: '.arena', dragSpeed: 0.5 });
```

### `dragThreshold`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/dragthreshold/>
- Accepts: `Number | { mouse: Number, touch: Number } | (() => Number | { mouse: Number, touch: Number })`
- Default: `{ mouse: 3, touch: 7 }`
- This is the pointer distance required before a grab becomes an actual drag.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.card-a', {
  container: '.arena',
  dragThreshold: 18,
});

createDraggable('.card-b', {
  container: '.arena',
  dragThreshold: { mouse: 6, touch: 14 },
});
```

### `scrollThreshold`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/scrollthreshold/>
- Accepts: `Number | (() => Number)`
- Default: `20`
- The element must cross this far past the bounds before auto-scroll starts.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.scroll-chip', {
  container: '.scroll-box',
  scrollThreshold: 10,
});
```

```html
<div class="scroll-box">
  <div class="scroll-content">
    <div class="scroll-chip">drag</div>
  </div>
</div>
```

```css
.scroll-box {
  width: 15rem;
  height: 9rem;
  overflow: auto;
  border: 1px solid #cbd5e1;
}

.scroll-content {
  position: relative;
  width: 28rem;
  height: 20rem;
}
```

### `scrollSpeed`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/scrollspeed/>
- Accepts: `Number | (() => Number)`
- Default: `1.5`
- Larger numbers scroll faster. `0` disables auto-scroll movement.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.auto-scroll', {
  container: '.scroll-box',
  scrollSpeed: 2.5,
});
```

### `cursor`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-settings/cursor/>
- Accepts: `Boolean | { onHover: string, onGrab: string } | (() => Boolean | { onHover: string, onGrab: string })`
- Default: `{ onHover: 'grab', onGrab: 'grabbing' }`
- Only applies on fine-pointer devices that match `'(pointer:fine)'`.
- `false` disables the cursor styling.
- Function values refresh on resize and with `refresh()`.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.plain-cursor', { cursor: false });

createDraggable('.custom-cursor', {
  cursor: {
    onHover: 'move',
    onGrab: 'zoom-in',
  },
});
```

---

## Callbacks

Every draggable callback:

- accepts a function whose first argument is the draggable itself
- defaults to `noop`
- is defined directly on the `createDraggable()` parameter object

### `onGrab`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/ongrab/>
- Fires when the element is first grabbed.

```javascript
import { createDraggable } from 'animejs';

let grabs = 0;

createDraggable('.counter-grab', {
  onGrab: self => {
    grabs += 1;
    self.$target.textContent = `grab ${grabs}`;
  },
});
```

### `onDrag`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/ondrag/>
- Fires while the element is actively being dragged.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-drag', {
  onDrag: self => {
    self.$target.dataset.xy = `${Math.round(self.x)},${Math.round(self.y)}`;
  },
});
```

### `onUpdate`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/onupdate/>
- Fires whenever the draggable position changes, including imperative updates.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-update', {
  onUpdate: self => {
    self.$target.style.setProperty('--progress-x', self.progressX.toFixed(3));
  },
});
```

### `onRelease`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/onrelease/>
- Fires after a grabbed element is released.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-release', {
  onRelease: self => {
    self.$target.textContent = 'released';
  },
});
```

### `onSnap`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/onsnap/>
- Fires each time snapping happens during dragging.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-snap', {
  snap: 20,
  onSnap: self => {
    self.$target.textContent = `snap ${self.snapX}/${self.snapY}`;
  },
});
```

### `onSettle`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/onsettle/>
- Fires once motion fully comes to rest after release.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-settle', {
  container: '.arena',
  onSettle: self => {
    self.$target.classList.add('is-settled');
  },
});
```

### `onResize`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/onresize/>
- Fires when the container or the target changes size.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-resize', {
  container: '.resizable-shell',
  onResize: self => {
    self.$target.dataset.bounds = self.containerBounds.join(',');
  },
});
```

### `onAfterResize`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-callbacks/onafterresize/>
- Fires after resize handling has already updated draggable internals.
- Good place to move the element back into view after a layout change.

```javascript
import { createDraggable } from 'animejs';

createDraggable('.counter-after-resize', {
  container: '.resizable-shell',
  onAfterResize: self => {
    self.animateInView(250, 12);
  },
});
```

---

## Methods

All documented methods return the draggable itself.

### `disable()`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/disable/>
- Makes the draggable inactive.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.dot');
document.querySelector('.disable-btn').addEventListener('click', () => drag.disable());
```

### `enable()`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/enable/>
- Re-enables a previously disabled draggable.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.dot');
drag.disable();
document.querySelector('.enable-btn').addEventListener('click', () => drag.enable());
```

### `setX(x, muteCallback = false)`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/setx/>

| Parameter | Type | Notes |
|---|---|---|
| `x` | `Number` | New horizontal value |
| `muteCallback` | `Boolean` | If `true`, skips `onUpdate` for this write |

- Equivalent to assigning `draggable.x` when `muteCallback` is omitted.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.dot');
document.querySelector('.jump-x').addEventListener('click', () => drag.setX(96));
```

### `setY(y, muteCallback = false)`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/sety/>

| Parameter | Type | Notes |
|---|---|---|
| `y` | `Number` | New vertical value |
| `muteCallback` | `Boolean` | If `true`, skips `onUpdate` for this write |

- Equivalent to assigning `draggable.y` when `muteCallback` is omitted.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.dot');
document.querySelector('.jump-y').addEventListener('click', () => drag.setY(-48));
```

### `animateInView(duration = 350, gap, ease = 'InOutQuad')`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/animateinview/>

| Parameter | Type in docs | Notes |
|---|---|---|
| `duration` | `Number` | Animation time |
| `gap` | `Boolean` | Docs table says `Boolean`, but the official example passes a numeric edge gap |
| `ease` | `ease` | Easing for the correction move |

- Animates the target back inside the container when it is outside view.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.offscreen-card', { container: '.viewport' });
drag.x = -32;
drag.y = 84;

document.querySelector('.bring-back').addEventListener('click', () => {
  drag.animateInView(300, 16, 'inOutQuad');
});
```

### `scrollInView(duration = 350, gap, ease = 'InOutQuad')`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/scrollinview/>

| Parameter | Type in docs | Notes |
|---|---|---|
| `duration` | `Number` | Scroll animation time |
| `gap` | `Boolean` | Docs table says `Boolean`, but the official example passes a numeric value |
| `ease` | `ease` | Easing for container scrolling |

- Scrolls the container so an out-of-threshold draggable becomes visible again.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.scroll-card', { container: '.scroll-box' });
drag.x = 180;
drag.y = 220;

document.querySelector('.scroll-back').addEventListener('click', () => {
  drag.scrollInView(320, 48, 'inOutQuad');
});
```

### `stop()`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/stop/>
- Stops target animations, scroll animations, and the release animation.

```javascript
import { animate, createDraggable } from 'animejs';

const drag = createDraggable('.animated-dot');
animate(drag, { x: [-80, 80], alternate: true, loop: true });

document.querySelector('.stop-btn').addEventListener('click', () => drag.stop());
```

### `reset()`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/reset/>
- Sends the element back to its starting position.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.reset-card');
document.querySelector('.reset-btn').addEventListener('click', () => drag.reset());
```

### `revert()`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/revert/>
- Restores the original state and deactivates the draggable.

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.revert-card');
document.querySelector('.revert-btn').addEventListener('click', () => drag.revert());
```

### `refresh()`

- Official subsection: <https://animejs.com/documentation/draggable/draggable-methods/refresh/>
- Recomputes all function-backed values and refreshes internal measurements.

Refreshable parameters called out by the docs:

- `snap`
- `container`
- `containerPadding`
- `containerFriction`
- `dragSpeed`
- `scrollSpeed`
- `scrollThreshold`
- `minVelocity`
- `maxVelocity`
- `velocityMultiplier`

```javascript
import { createDraggable } from 'animejs';

const drag = createDraggable('.live-rules', {
  snap: () => Math.random() > 0.5 ? 16 : 32,
  dragSpeed: () => window.innerWidth > 700 ? 1.2 : 0.8,
});

window.addEventListener('resize', () => drag.refresh());
```

---

## Properties

- Official section: <https://animejs.com/documentation/draggable/draggable-properties/>
- The docs expose one properties table rather than per-property subsections.

### Tuning properties

| Property | Meaning |
|---|---|
| `snapX` | Read or replace the current x-axis snap rule |
| `snapY` | Read or replace the current y-axis snap rule |
| `scrollSpeed` | Read or replace the current auto-scroll speed |
| `scrollThreshold` | Read or replace the current auto-scroll trigger distance |
| `dragSpeed` | Read or replace the current drag-speed multiplier |
| `maxVelocity` | Read or replace the release velocity ceiling |
| `minVelocity` | Read or replace the release velocity floor |
| `velocityMultiplier` | Read or replace the throw multiplier |
| `releaseEase` | Read or replace the easing used after release |
| `releaseSpring` | Access the internal spring used during release |
| `containerPadding` | Read or replace `[top, right, bottom, left]` padding values |
| `containerFriction` | Read or replace the current container friction |

### Bounds and container references

| Property | Meaning |
|---|---|
| `containerBounds` | Current container edges as `[top, right, bottom, left]` |
| `containerArray` | Array of container elements when multiple were supplied, otherwise `null` |
| `$container` | Current container element |
| `$target` | Current dragged element |
| `$trigger` | Current trigger element |
| `$scrollContainer` | The active scroll host, either `window` or an element |

### Position and motion values

| Property | Meaning |
|---|---|
| `x` | Current x position |
| `y` | Current y position |
| `progressX` | Horizontal progress from `0` to `1` within the container |
| `progressY` | Vertical progress from `0` to `1` within the container |
| `velocity` | Current draggable velocity |
| `angle` | Current motion angle in radians |
| `xProp` | Property name currently driven by the x axis |
| `yProp` | Property name currently driven by the y axis |
| `destX` | Current x destination |
| `destY` | Current y destination |
| `deltaX` | Current x delta |
| `deltaY` | Current y delta |

### State flags and behavior flags

| Property | Meaning |
|---|---|
| `enabled` | `true` when dragging is enabled |
| `grabbed` | `true` while the pointer is grabbing the target |
| `dragged` | `true` while the target is actively dragging |
| `cursor` | Current cursor behavior config |
| `disabled` | Disabled state array for the `[x, y]` axes |
| `fixed` | `true` when the target uses `position: fixed` |
| `useWin` | `true` when the window is acting as the container |
| `isFinePointer` | Fine-pointer mode flag, typically mouse-like input |
| `initialized` | `true` after setup has completed |
| `canScroll` | `true` when auto-scroll is available |
| `contained` | `true` when the target is inside bounds |
| `manual` | `true` when the draggable is under manual control |
| `released` | `true` just after a release event |
| `updated` | `true` just after a position update |

### Geometry and pointer snapshots

| Property | Meaning |
|---|---|
| `scroll` | Current scroll position object `{ x, y }` |
| `coords` | Current and previous coordinates `[x, y, prevX, prevY]` |
| `snapped` | Snap-state array for `[x, y]` |
| `pointer` | Current and previous pointer coordinates `[x, y, prevX, prevY]` |
| `scrollView` | Scroll viewport size `[width, height]` |
| `dragArea` | Drag area rectangle `[x, y, width, height]` |
| `scrollBounds` | Scroll-container edges `[top, right, bottom, left]` |
| `targetBounds` | Target bounds `[top, right, bottom, left]` |
| `window` | Window size `[width, height]` |
| `pointerVelocity` | Live pointer velocity |
| `pointerAngle` | Live pointer angle in radians |
| `activeProp` | Property currently being animated |

### Callback references

| Property | Meaning |
|---|---|
| `onGrab` | Current grab callback reference |
| `onDrag` | Current drag callback reference |
| `onRelease` | Current release callback reference |
| `onUpdate` | Current update callback reference |
| `onSettle` | Current settle callback reference |
| `onSnap` | Current snap callback reference |
| `onResize` | Current resize callback reference |
| `onAfterResize` | Current post-resize callback reference |

---

## Practical Notes

- `snap`, `modifier`, and `mapTo` can be applied globally or per axis depending on how specific you need the behavior to be.
- Use function-returned values only for the settings the docs mark as refreshable, then call `refresh()` if your app changes their source values without a resize.
- If you want a handle separate from the moved node, pair `trigger` with the default target element.
- If you need a hard clamp after release, raise `releaseContainerFriction`; if you want a livelier throw, tune `velocityMultiplier`, `releaseMass`, and `releaseEase` together.
