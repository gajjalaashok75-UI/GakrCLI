---
name: animejs-timeline
description: Anime.js createTimeline() reference covering sequencing, sync APIs, positions, playback settings, callbacks, methods, and properties. Use when orchestrating multiple animations, timers, labels, and callback steps.
---

# Timeline Module

Synchronizes animations, timers, WAAPI animations, nested timelines, labels, and callback hooks behind a single playhead.

## Official reference

- Main page: <https://animejs.com/documentation/timeline/>
- Coverage in this file: the main Timeline page plus every linked Timeline subsection for add timers, add animations, sync WAAPI animations, sync timelines, call functions, time position, playback settings, callbacks, methods, and properties.

### Direct subsection links

| Group | Section | URL |
|---|---|---|
| Core | Timeline | <https://animejs.com/documentation/timeline/> |
| Core | Add timers | <https://animejs.com/documentation/timeline/add-timers/> |
| Core | Add animations | <https://animejs.com/documentation/timeline/add-animations/> |
| Core | Sync WAAPI animations | <https://animejs.com/documentation/timeline/sync-waapi-animations> |
| Core | Sync timelines | <https://animejs.com/documentation/timeline/sync-timelines/> |
| Core | Call functions | <https://animejs.com/documentation/timeline/call-functions> |
| Core | Time position | <https://animejs.com/documentation/timeline/time-position/> |
| Playback | Timeline playback settings | <https://animejs.com/documentation/timeline/timeline-playback-settings/> |
| Playback | `defaults` | <https://animejs.com/documentation/timeline/timeline-playback-settings/defaults/> |
| Playback | `delay` | <https://animejs.com/documentation/timeline/timeline-playback-settings/delay/> |
| Playback | `loop` | <https://animejs.com/documentation/timeline/timeline-playback-settings/loop/> |
| Playback | `loopDelay` | <https://animejs.com/documentation/timeline/timeline-playback-settings/playback-loopdelay/> |
| Playback | `alternate` | <https://animejs.com/documentation/timeline/timeline-playback-settings/alternate/> |
| Playback | `reversed` | <https://animejs.com/documentation/timeline/timeline-playback-settings/reversed/> |
| Playback | `autoplay` | <https://animejs.com/documentation/timeline/timeline-playback-settings/autoplay/> |
| Playback | `frameRate` | <https://animejs.com/documentation/timeline/timeline-playback-settings/framerate/> |
| Playback | `playbackRate` | <https://animejs.com/documentation/timeline/timeline-playback-settings/playbackrate/> |
| Playback | `playbackEase` | <https://animejs.com/documentation/timeline/timeline-playback-settings/playbackease/> |
| Callbacks | Timeline callbacks | <https://animejs.com/documentation/timeline/timeline-callbacks> |
| Callbacks | `onBegin` | <https://animejs.com/documentation/timeline/timeline-callbacks/onbegin/> |
| Callbacks | `onComplete` | <https://animejs.com/documentation/timeline/timeline-callbacks/oncomplete/> |
| Callbacks | `onBeforeUpdate` | <https://animejs.com/documentation/timeline/timeline-callbacks/onbeforeupdate/> |
| Callbacks | `onUpdate` | <https://animejs.com/documentation/timeline/timeline-callbacks/onupdate/> |
| Callbacks | `onRender` | <https://animejs.com/documentation/timeline/timeline-callbacks/onrender/> |
| Callbacks | `onLoop` | <https://animejs.com/documentation/timeline/timeline-callbacks/onloop/> |
| Callbacks | `onPause` | <https://animejs.com/documentation/timeline/timeline-callbacks/onpause/> |
| Callbacks | `then()` | <https://animejs.com/documentation/timeline/timeline-callbacks/then/> |
| Methods | Timeline methods | <https://animejs.com/documentation/timeline/timeline-methods/> |
| Methods | `add()` | <https://animejs.com/documentation/timeline/timeline-methods/add/> |
| Methods | `set()` | <https://animejs.com/documentation/timeline/timeline-methods/set/> |
| Methods | `sync()` | <https://animejs.com/documentation/timeline/timeline-methods/sync/> |
| Methods | `label()` | <https://animejs.com/documentation/timeline/timeline-methods/label/> |
| Methods | `remove()` | <https://animejs.com/documentation/timeline/timeline-methods/remove/> |
| Methods | `call()` | <https://animejs.com/documentation/timeline/timeline-methods/call/> |
| Methods | `init()` | <https://animejs.com/documentation/timeline/timeline-methods/init/> |
| Methods | `play()` | <https://animejs.com/documentation/timeline/timeline-methods/play/> |
| Methods | `reset()` | <https://animejs.com/documentation/timeline/timeline-methods/reset> |
| Methods | `reverse()` | <https://animejs.com/documentation/timeline/timeline-methods/reverse/> |
| Methods | `pause()` | <https://animejs.com/documentation/timeline/timeline-methods/pause/> |
| Methods | `restart()` | <https://animejs.com/documentation/timeline/timeline-methods/restart/> |
| Methods | `alternate()` | <https://animejs.com/documentation/timeline/timeline-methods/alternate/> |
| Methods | `resume()` | <https://animejs.com/documentation/timeline/timeline-methods/resume/> |
| Methods | `complete()` | <https://animejs.com/documentation/timeline/timeline-methods/complete/> |
| Methods | `cancel()` | <https://animejs.com/documentation/timeline/timeline-methods/cancel/> |
| Methods | `revert()` | <https://animejs.com/documentation/timeline/timeline-methods/revert/> |
| Methods | `seek()` | <https://animejs.com/documentation/timeline/timeline-methods/seek/> |
| Methods | `stretch()` | <https://animejs.com/documentation/timeline/timeline-methods/stretch/> |
| Methods | `refresh()` | <https://animejs.com/documentation/timeline/timeline-methods/refresh/> |
| Properties | Timeline properties | <https://animejs.com/documentation/timeline/timeline-properties/> |

---

## Imports And Creation

Create timelines from the main package or the timeline-only subpath:

```javascript
import { createTimeline } from 'animejs';

const timeline = createTimeline(parameters);
```

```javascript
import { createTimeline } from 'animejs/timeline';

const timeline = createTimeline(parameters);
```

Related helpers used throughout the official examples:

```javascript
import {
  animate,
  createTimer,
  engine,
  onScroll,
  stagger,
  utils,
  waapi,
} from 'animejs';
```

### Parameters

| Name | Accepts |
|---|---|
| `parameters` | An optional `Object` made of Timeline playback settings and Timeline callbacks |

### Returns

`Timeline`

The returned instance exposes the insertion, playback, mutation, and inspection APIs documented below.

```javascript
timeline.add(targets, animationParameters, position);
timeline.add(timerParameters, position);
timeline.sync(synced, position);
timeline.call(callbackFunction, position);
timeline.label(labelName, position);
```

### Fresh timeline example

Reuse the HTML and CSS scaffold in the next section.

```javascript
import { createTimeline } from 'animejs';

const timeline = createTimeline({
  defaults: { duration: 600, ease: 'inOut(3)' },
})
  .label('intro', 0)
  .add('.square', { x: '14rem' }, 250)
  .add('.circle', { x: '10rem', scale: [0.8, 1.15, 1] }, 'intro')
  .add('.triangle', { x: '12rem', rotate: '1turn' }, '<-=150')
  .call(() => {
    document.querySelector('.log').textContent = 'timeline reached the final callback';
  }, '+=150');
```

---

## Shared Example Markup

Most snippets below assume a small demo stage like this:

```html
<div class="timeline-demo">
  <div class="stage">
    <div class="shape circle"></div>
    <div class="shape square"></div>
    <div class="shape triangle"></div>
  </div>
  <pre class="log">idle</pre>
  <div class="controls">
    <button class="play-btn">Play</button>
    <button class="pause-btn">Pause</button>
    <input class="range" type="range" min="0" max="3000" value="0" />
  </div>
</div>
```

```css
.timeline-demo {
  display: grid;
  gap: 1rem;
  max-width: 36rem;
  margin: 2rem auto;
  font: 14px/1.4 "Segoe UI", sans-serif;
}

.stage {
  position: relative;
  min-height: 9rem;
  padding: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  overflow: hidden;
}

.shape {
  position: absolute;
  left: 1rem;
}

.circle {
  top: 1rem;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 999px;
  background: #22c55e;
}

.square {
  top: 3.75rem;
  width: 2.75rem;
  height: 2.75rem;
  background: #38bdf8;
}

.triangle {
  top: 6.35rem;
  width: 0;
  height: 0;
  border-left: 1.4rem solid transparent;
  border-right: 1.4rem solid transparent;
  border-bottom: 2.4rem solid #f97316;
}

.log {
  margin: 0;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #e2e8f0;
  color: #0f172a;
}

.controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.controls button,
.controls input[type='range'] {
  flex: 1 1 10rem;
}
```

---

## Add Timers

Official subsection: <https://animejs.com/documentation/timeline/add-timers/>

The official docs split timer insertion into two paths:

| API | Purpose | Parameters | Returns |
|---|---|---|---|
| `timeline.add(parameters, position)` | Create a timer inline and insert it immediately | `parameters`: Timer playback settings + Timer callbacks, `position`: optional Time position | The timeline itself |
| `timeline.sync(timer, position)` | Attach an already-created timer | `timer`: `Timer`, `position`: optional Time position | The timeline itself |

Fresh example:

```javascript
import { createTimeline, createTimer } from 'animejs';

const log = document.querySelector('.log');

const pulseTimer = createTimer({
  duration: 900,
  onUpdate: self => {
    log.textContent = `synced timer: ${Math.round(self.currentTime)}ms`;
  },
});

createTimeline()
  .sync(pulseTimer, 0)
  .add({
    duration: 450,
    onBegin: () => {
      log.textContent = 'inline timer began';
    },
  }, '+=200');
```

## Add Animations

Official subsection: <https://animejs.com/documentation/timeline/add-animations/>

Animation insertion also has two paths:

| API | Purpose | Parameters | Returns |
|---|---|---|---|
| `timeline.add(targets, parameters, position)` | Create a child animation inside the timeline | `targets`: Targets, `parameters`: Animatable properties + Tween parameters + Animation playback settings + Animation callbacks, `position`: optional Time position | The timeline itself |
| `timeline.sync(animation, position)` | Attach an animation created elsewhere | `animation`: `Animation`, `position`: optional Time position | The timeline itself |

The docs note an important distinction: inline `add()` participates in tween composition with the timeline's existing children, while a prebuilt animation keeps the tween composition it already had when it was created.

Fresh example:

```javascript
import { animate, createTimeline } from 'animejs';

const prebuilt = animate('.circle', {
  x: '9rem',
  autoplay: false,
});

createTimeline()
  .sync(prebuilt, 0)
  .add('.triangle', {
    x: '12rem',
    rotate: '1turn',
    duration: 500,
  }, '+=100')
  .add('.square', {
    x: '14rem',
    scale: [1, 1.2, 1],
  }, '<');
```

## Sync WAAPI Animations

Official subsection: <https://animejs.com/documentation/timeline/sync-waapi-animations>

This subsection shows that WAAPI-driven animations can be inserted with `sync()`:

```javascript
timeline.sync(animation, position);
```

| Name | Accepts |
|---|---|
| `animation` | A WAAPI animation instance, typically created with `waapi.animate()` |
| `position` | Optional Time position |

Returns: the timeline itself.

The dedicated `sync()` method page expands the accepted `synced` types to `JSAnimation`, `Timer`, `Timeline`, Anime.js `WAAPIAnimation`, and native `WAAPIAnimation`, which is the broader signature this subsection is pointing at.

Fresh example:

```javascript
import { createTimeline, waapi } from 'animejs';

const nativeLike = waapi.animate('.square', {
  x: '13rem',
  duration: 700,
});

createTimeline({ defaults: { duration: 500 } })
  .add('.circle', { x: '8rem' }, 0)
  .sync(nativeLike, '+=100')
  .add('.triangle', { x: '11rem', rotate: '1turn' }, '<');
```

## Sync Timelines

Official subsection: <https://animejs.com/documentation/timeline/sync-timelines/>

Use `sync()` to attach one timeline to another:

```javascript
timelineA.sync(timelineB, position);
```

| Name | Accepts |
|---|---|
| `synced` | A timeline, or more generally another syncable item accepted by `sync()` |
| `position` | Optional Time position |

Returns: the timeline itself.

Fresh example:

```javascript
import { createTimeline } from 'animejs';

const spinLayer = createTimeline({ defaults: { duration: 800 } })
  .add('.circle', { rotate: '1turn' }, 0)
  .add('.square', { rotate: '-1turn' }, 0);

const moveLayer = createTimeline({ defaults: { duration: 600 } })
  .add('.circle', { x: '10rem' }, 0)
  .add('.triangle', { x: '13rem' }, 150);

createTimeline()
  .sync(moveLayer, 0)
  .sync(spinLayer, '-=300');
```

## Call Functions

Official subsection: <https://animejs.com/documentation/timeline/call-functions>

The callback insertion API is:

```javascript
timeline.call(callback, position);
```

| Name | Accepts |
|---|---|
| `callback` | `Function` |
| `position` | Optional Time position |

Returns: the timeline itself.

Fresh example:

```javascript
import { createTimeline } from 'animejs';

const log = document.querySelector('.log');

createTimeline()
  .call(() => {
    log.textContent = 'phase one';
  }, 0)
  .call(() => {
    log.textContent = 'phase two';
  }, 500)
  .call(() => {
    log.textContent = 'done';
  }, 1100);
```

## Time Position

Official subsection: <https://animejs.com/documentation/timeline/time-position/>

Time position controls where a child gets inserted. If you omit it, the child lands at the end of the current timeline.

The official page applies this concept to the last argument of:

```javascript
timeline.add(targets, animationParameters, position);
timeline.add(timerParameters, position);
timeline.call(callbackFunction, position);
timeline.sync(synced, position);
timeline.label(labelName, position);
```

### Time position types

| Type | Syntax | Meaning |
|---|---|---|
| Absolute | `100` | Place the child at exactly 100 ms |
| Addition | `'+=100'` | Start 100 ms after the previous child |
| Subtraction | `'-=100'` | Start 100 ms before the previous child ends |
| Multiplier | `'*=.5'` | Start at half of the current total duration |
| Previous end | `'<'` | Start where the previous child ends |
| Previous start | `'<<'` | Start where the previous child begins |
| Combined | `'<<+=250'` | Offset from the previous child's start |
| Label | `'My Label'` | Start at a named label |
| Stagger | `stagger(10)` | Offset multiple inserted elements by a staggered amount |

Fresh example:

```javascript
import { createTimeline, stagger } from 'animejs';

createTimeline({ defaults: { duration: 400 } })
  .label('intro', 0)
  .add('.square', { x: '12rem' }, 200)
  .add('.circle', { x: '8rem' }, 'intro')
  .add('.triangle', { rotate: '1turn' }, '<+=150')
  .add('.square', { y: '-1rem' }, '*=.5')
  .add('.circle', { scale: [1, 1.2, 1] }, stagger(120));
```

---

## Playback Settings

Official page: <https://animejs.com/documentation/timeline/timeline-playback-settings/>

Timeline playback settings live directly inside the `createTimeline()` options object:

```javascript
createTimeline({
  defaults: {
    ease: 'out(3)',
    duration: 500,
  },
  loop: 3,
  alternate: true,
  autoplay: false,
  onBegin: () => {},
  onLoop: () => {},
  onUpdate: () => {},
});
```

### `defaults`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/defaults/>

- Accepts: an `Object` of Tween parameters except `from` and `to`, plus playback settings and callbacks.
- Default: the official page does not list a separate default value.
- Purpose: set child-level defaults once, then override them per inserted animation or timer when needed.

```javascript
createTimeline({
  defaults: {
    duration: 500,
    ease: 'inOutExpo',
    alternate: true,
  },
})
  .add('.circle', { x: '9rem' })
  .add('.square', { x: '13rem', duration: 250 });
```

### `delay`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/delay/>

- Accepts: a `Number` greater than or equal to `0`.
- Default: `0`.
- Purpose: wait before the timeline begins.

```javascript
createTimeline({ delay: 600 })
  .add('.circle', { x: '10rem' })
  .add('.triangle', { x: '12rem' }, '-=150');
```

### `loop`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/loop/>

- Accepts: a finite `Number`, `Infinity`, `true`, or `-1`.
- Default: `0`.
- Notes: `true` and `-1` both mean "loop forever".

```javascript
let loops = 0;

createTimeline({
  loop: true,
  onLoop: () => {
    document.querySelector('.log').textContent = `loops: ${++loops}`;
  },
}).add('.square', { x: '14rem' });
```

### `loopDelay`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/playback-loopdelay/>

- Accepts: a `Number` greater than or equal to `0`.
- Default: `0`.
- Purpose: pause between iterations.

```javascript
createTimeline({
  loop: true,
  loopDelay: 400,
})
  .add('.circle', { x: '9rem' })
  .add('.triangle', { x: '11rem' }, '-=200');
```

### `alternate`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/alternate/>

- Accepts: `Boolean`.
- Default: `false`.
- Purpose: flip direction on each loop when looping is enabled.

```javascript
createTimeline({
  loop: true,
  alternate: true,
}).add('.square', { x: '14rem' });
```

### `reversed`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/reversed/>

- Accepts: `Boolean`.
- Default: `false`.
- Purpose: choose the starting direction.

```javascript
createTimeline({
  reversed: true,
  onUpdate: self => {
    document.querySelector('.log').textContent = `time: ${Math.round(self.currentTime)}ms`;
  },
})
  .add('.circle', { x: '8rem' })
  .add('.square', { x: '14rem' }, '-=200');
```

### `autoplay`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/autoplay/>

- Accepts: `Boolean` or `onScroll()`.
- Default: `true`.
- Purpose: decide whether the timeline starts by itself, waits for manual playback, or hooks into scroll thresholds.

```javascript
const tl = createTimeline({ autoplay: false })
  .add('.triangle', { x: '11rem', rotate: '1turn' });

document.querySelector('.play-btn').addEventListener('click', () => tl.play());
```

```javascript
createTimeline({
  autoplay: onScroll(),
}).add('.circle', { x: '10rem' });
```

### `frameRate`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/framerate/>

- Accepts: a `Number` greater than `0`.
- Default: `120`.
- Notes: the browser and display can still cap the effective frame rate.
- Runtime mapping: the docs show that you can change it later with `timeline.fps = value`.

```javascript
const tl = createTimeline({
  frameRate: 60,
  loop: true,
}).add('.circle', { x: '9rem' });

tl.fps = 30;
```

### `playbackRate`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/playbackrate/>

- Accepts: a `Number` greater than or equal to `0`.
- Default: `1`.
- Notes: `0` means the timeline will not play.
- Runtime mapping: the docs show later updates through `timeline.speed`.

```javascript
const tl = createTimeline({
  playbackRate: 1.5,
  loop: true,
}).add('.square', { x: '13rem' });

tl.speed = 0.75;
```

### `playbackEase`

Official subsection: <https://animejs.com/documentation/timeline/timeline-playback-settings/playbackease/>

- Accepts: an Anime.js ease.
- Default: `null`.
- Purpose: ease the overall motion of the playhead itself, not just each child tween.

```javascript
createTimeline({
  playbackEase: 'inOut(3)',
})
  .add('.circle', { x: '8rem', ease: 'out(1)' })
  .add('.triangle', { x: '11rem', ease: 'out(2)' })
  .add('.square', { x: '14rem', ease: 'out(3)' });
```

---

## Callbacks

Official page: <https://animejs.com/documentation/timeline/timeline-callbacks>

Timeline callbacks are declared in the `createTimeline()` options object. They run at specific moments in the timeline lifecycle.

### `onBegin`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/onbegin/>

- Accepts: a `Function` whose first argument is the timeline itself.
- Default: `noop`.
- Use it when the timeline truly starts, after any configured `delay`.

```javascript
createTimeline({
  delay: 500,
  onBegin: self => {
    document.querySelector('.log').textContent = `began: ${self.began}`;
  },
}).add('.circle', { x: '9rem' });
```

### `onComplete`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/oncomplete/>

- Accepts: a `Function` whose first argument is the timeline itself.
- Default: `noop`.
- Fires after every planned iteration has finished.

```javascript
createTimeline({
  loop: 1,
  onComplete: self => {
    document.querySelector('.log').textContent = `completed: ${self.completed}`;
  },
}).add('.square', { x: '14rem' });
```

### `onBeforeUpdate`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/onbeforeupdate/>

- Accepts: a `Function` whose first argument is the timeline itself.
- Default: `noop`.
- Runs every frame before child values are updated, using the configured `frameRate`.

```javascript
let ticks = 0;

createTimeline({
  defaults: { duration: 400 },
  loop: true,
  onBeforeUpdate: () => {
    document.querySelector('.log').textContent = `pre-update ticks: ${++ticks}`;
  },
})
  .add('.circle', { x: '8rem' })
  .add('.triangle', { x: '11rem' }, '+=100');
```

### `onUpdate`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/onupdate/>

- Accepts: a `Function` whose first argument is the timeline itself.
- Default: `noop`.
- Runs every frame while the timeline is active.

```javascript
createTimeline({
  onUpdate: self => {
    document.querySelector('.log').textContent = `${Math.round(self.currentTime)}ms`;
  },
}).add('.square', { x: '14rem' });
```

### `onRender`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/onrender/>

- Accepts: a `Function` whose first argument is the timeline itself.
- Default: `noop`.
- Runs only when something is actually rendered, so `delay`, `loopDelay`, or fully idle spans do not count.

```javascript
let renders = 0;

createTimeline({
  defaults: { duration: 350 },
  loopDelay: 250,
  loop: true,
  onRender: () => {
    document.querySelector('.log').textContent = `renders: ${++renders}`;
  },
})
  .add('.circle', { x: '8rem' })
  .add('.square', { x: '14rem' }, '+=150');
```

### `onLoop`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/onloop/>

- Accepts: a `Function` whose first argument is the timeline itself.
- Default: `noop`.
- Fires when an iteration finishes.

```javascript
let loops = 0;

createTimeline({
  loop: true,
  loopDelay: 300,
  onLoop: () => {
    document.querySelector('.log').textContent = `loops: ${++loops}`;
  },
}).add('.triangle', { x: '12rem', rotate: '1turn' });
```

### `onPause`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/onpause/>

- Accepts: a callback. The official page says the first argument is "the animation itself"; in timeline context that reads as the active timeline instance.
- Default: `noop`.
- The page lists several pause paths, including manual `.pause()`, `.cancel()`, `.revert()`, a full overlap by `composition: 'replace'`, or losing all animating targets while no timers remain.

```javascript
const tl = createTimeline({
  onPause: () => {
    document.querySelector('.log').textContent = 'timeline paused';
  },
}).add('.circle', { x: '10rem', duration: 1600 });

document.querySelector('.pause-btn').addEventListener('click', () => tl.pause());
```

### `then()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-callbacks/then/>

The official docs treat `then()` as the promise-facing completion hook for a timeline.

| Name | Type |
|---|---|
| `callback` | A `Function` whose first argument is the timeline itself |

Returns: `Promise`

The page shows both direct chaining and `async` / `await` usage.

```javascript
const tl = createTimeline({
  defaults: { duration: 400 },
})
  .add('.circle', { x: '8rem' })
  .add('.square', { x: '14rem' });

tl.then(() => {
  document.querySelector('.log').textContent = 'promise fulfilled';
});
```

---

## Methods

Official page: <https://animejs.com/documentation/timeline/timeline-methods/>

Every method below is part of the `Timeline` instance returned by `createTimeline()`.

### `add()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/add/>

Creates and inserts either animations or timers.

| Overload | Parameters | Returns |
|---|---|---|
| `timeline.add(targets, parameters, position)` | `targets`: Targets, `parameters`: Animatable properties + Tween parameters + Animation playback settings + Animation callbacks, `position`: optional Time position | The timeline itself |
| `timeline.add(timerParameters, position)` | `timerParameters`: Timer playback settings + Timer callbacks, `position`: optional Time position | The timeline itself |

```javascript
createTimeline()
  .label('counter', 0)
  .add({
    duration: 500,
    onUpdate: self => {
      document.querySelector('.log').textContent = `${Math.round(self.currentTime)}ms`;
    },
  }, 'counter')
  .add('.circle', { x: '10rem', duration: 900 }, 250);
```

### `set()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/set/>

Sets property values at a chosen time instead of tweening them.

| Name | Accepts |
|---|---|
| `targets` | Targets |
| `parameters` | Animatable properties |
| `position` | Optional Time position |

Returns: the timeline itself.

```javascript
createTimeline()
  .set('.circle', { x: '8rem' }, 0)
  .set('.square', { x: '14rem' }, 500)
  .set('.triangle', { rotate: '1turn' }, 1000);
```

### `sync()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/sync/>

Synchronizes an existing child object to the timeline.

| Name | Accepts |
|---|---|
| `synced` | `JSAnimation`, `Timer`, `Timeline`, Anime.js `WAAPIAnimation`, or native `WAAPIAnimation` |
| `position` | Optional Time position |

Returns: the timeline itself.

```javascript
import { animate, createTimeline, waapi } from 'animejs';

const jsChild = animate('.circle', { x: '8rem', autoplay: false });
const waapiChild = waapi.animate('.square', { x: '14rem', duration: 600 });

createTimeline()
  .sync(jsChild, 0)
  .sync(waapiChild, '-=200');
```

### `label()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/label/>

Names a moment on the timeline so later insertions can target it.

| Name | Accepts |
|---|---|
| `labelName` | `String` |
| `position` | Optional Time position |

Returns: the timeline itself.

```javascript
createTimeline()
  .label('circleIn', 0)
  .label('triangleSpin', 400)
  .add('.circle', { x: '8rem' }, 'circleIn')
  .add('.triangle', { rotate: '1turn' }, 'triangleSpin');
```

### `remove()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/remove/>

Removes whole synced objects, targets, or just one property tween.

| Overload | Parameters | Returns |
|---|---|---|
| `timeline.remove(object)` | `object`: `Animation`, `Timer`, or `Timeline` | The timeline itself |
| `timeline.remove(targets)` | `targets`: Targets | The timeline itself |
| `timeline.remove(targets, propertyName)` | `targets`: Targets, `propertyName`: animatable property `String` | The timeline itself |

The docs also note that removal does not reshape the existing timeline duration.

```javascript
import { animate, createTimeline } from 'animejs';

const standalone = animate('.circle', { x: '8rem', autoplay: false });

const tl = createTimeline()
  .sync(standalone)
  .add('.triangle', { x: '12rem', rotate: '1turn' }, 100)
  .add('.square', { x: '14rem' }, 200);

tl.remove(standalone);
tl.remove('.square');
tl.remove('.triangle', 'rotate');
```

### `call()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/call/>

Schedules a plain function at a chosen point.

| Name | Accepts |
|---|---|
| `callback` | `Function` |
| `position` | Optional Time position |

Returns: the timeline itself.

```javascript
createTimeline()
  .call(() => {
    document.querySelector('.log').textContent = 'A';
  }, 0)
  .call(() => {
    document.querySelector('.log').textContent = 'B';
  }, 600);
```

### `init()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/init/>

Forces all child initial states to render immediately. This matters when a child uses explicit `from` values, because timeline children do not automatically render those start values on insertion the same way standalone `animate()` does.

Parameters: none

Returns: the timeline itself.

```javascript
createTimeline()
  .add('.square', { x: { from: '14rem' } })
  .add('.triangle', { x: { from: '10rem' } }, 400)
  .init();
```

### `play()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/play/>

Forces forward playback.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline({ autoplay: false })
  .add('.circle', { x: '8rem' });

tl.play();
```

### `reset()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/reset>

Resets timing state and pauses the timeline.

| Name | Type | Description |
|---|---|---|
| `softReset = false` | `Boolean` | If `true`, reset internal values without forcing a visual rerender |

Returns: the timeline itself.

```javascript
const tl = createTimeline({ loop: true, alternate: true })
  .add('.square', { x: '14rem' });

tl.reset();
tl.reset(true);
```

### `reverse()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/reverse/>

Forces backward playback.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline()
  .add('.triangle', { x: '12rem', rotate: '1turn' });

tl.reverse();
```

### `pause()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/pause/>

Stops a currently running timeline in place.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline({ loop: true })
  .add('.circle', { x: '8rem', duration: 1200 });

tl.pause();
```

### `restart()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/restart/>

Moves back to the start and restores the original values of the children. If `autoplay` is still `true`, playback resumes immediately.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline({ alternate: true })
  .add('.square', { x: '14rem' });

tl.restart();
```

### `alternate()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/alternate/>

Flips playback direction and adjusts `currentTime` so the visible progress still lines up with the new direction.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline({ loop: true })
  .add('.circle', { x: '8rem' });

tl.alternate();
```

### `resume()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/resume/>

Continues a paused timeline in whichever direction it was already heading.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline({ autoplay: false })
  .add('.triangle', { x: '12rem' });

tl.play();
tl.pause();
tl.resume();
```

### `complete()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/complete/>

Jumps straight to the completed state.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline()
  .add('.square', { x: '14rem' });

tl.complete();
```

### `cancel()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/cancel/>

Pauses the timeline, detaches it from the engine loop, and frees the associated runtime work.

Parameters: none

Returns: the timeline itself.

```javascript
const tl = createTimeline({ loop: true })
  .add('.circle', { x: '8rem' });

tl.cancel();
```

### `revert()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/revert/>

Cancels the timeline, restores original animated values, removes inline styles introduced by Anime.js, and also reverts a linked `onScroll()` controller when relevant.

Parameters: none

Returns: the timeline itself.

```javascript
import { createTimeline, utils } from 'animejs';

utils.set(['.circle', '.square', '.triangle'], { x: '14rem' });

const tl = createTimeline({ alternate: true, loop: true })
  .add('.circle', { x: 0 })
  .add('.square', { x: 0 }, 300)
  .add('.triangle', { x: 0 }, 600);

tl.revert();
```

### `seek()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/seek/>

Sets the timeline playhead to a specific time.

| Name | Type | Description |
|---|---|---|
| `time` | `Number` | New `currentTime` in milliseconds |
| `muteCallbacks = false` | `Boolean` | Skip callback execution when `true` |

Returns: the timeline itself.

```javascript
const tl = createTimeline({ autoplay: false })
  .add('.circle', { x: '8rem' })
  .add('.square', { x: '14rem' }, 400);

tl.seek(500);
tl.seek(900, true);
```

### `stretch()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/stretch/>

Rescales the timeline and its children so the overall duration matches the provided total time. The official page reminds that total duration includes looped iterations.

| Name | Type | Description |
|---|---|---|
| `duration` | `Number` | New total duration in milliseconds |

Returns: the timeline itself.

```javascript
const tl = createTimeline({ loop: 1, alternate: true })
  .add('.circle', { x: '8rem' })
  .add('.triangle', { x: '12rem' }, 400);

tl.stretch(2400).restart();
```

### `refresh()`

Official subsection: <https://animejs.com/documentation/timeline/timeline-methods/refresh/>

Recomputes function-based animatable values by taking the targets' current values as the new starting point and evaluating the function again for the new target values. The official page explicitly says `duration` and `delay` are not refreshed.

Parameters: none

Returns: the timeline itself.

```javascript
import { createTimeline, utils } from 'animejs';

const tl = createTimeline({ loop: true })
  .add('.circle', { x: () => `${utils.random(2, 10)}rem` }, 0)
  .add('.square', { x: () => `${utils.random(8, 14)}rem` }, 0);

tl.refresh().restart();
```

---

## Properties

Official page: <https://animejs.com/documentation/timeline/timeline-properties/>

The official Timeline properties page is a single property table rather than separate per-property subsections. It describes these members on the `Timeline` instance:

| Property | Description |
|---|---|
| `id` | Gets or sets the timeline ID as a `String` or `Number` |
| `labels` | Gets or sets the map of label names to time positions |
| `currentTime` | Gets or sets the global current time in milliseconds |
| `iterationCurrentTime` | Gets or sets the current iteration time in milliseconds |
| `deltaTime` | Gets the elapsed time between the current and previous frame |
| `progress` | Gets or sets overall progress from `0` to `1` |
| `iterationProgress` | Gets or sets progress for the current iteration from `0` to `1` |
| `currentIteration` | Gets or sets the current iteration count |
| `duration` | Gets the total timeline duration in milliseconds |
| `speed` | Gets or sets the playback speed multiplier |
| `fps` | Gets or sets the timeline frame rate |
| `paused` | Gets or sets whether the timeline is paused |
| `began` | Gets or sets whether playback has begun |
| `completed` | Gets or sets whether playback has completed |
| `reversed` | Gets or sets whether the timeline is reversed |
| `backwards` | Gets whether the timeline is currently moving backward |

Fresh example:

```javascript
const tl = createTimeline({ autoplay: false })
  .label('intro', 0)
  .add('.circle', { x: '8rem' })
  .add('.square', { x: '14rem' }, 500);

console.log({
  id: tl.id,
  labels: tl.labels,
  currentTime: tl.currentTime,
  duration: tl.duration,
  progress: tl.progress,
  paused: tl.paused,
  backwards: tl.backwards,
});
```
