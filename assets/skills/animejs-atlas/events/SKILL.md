---
name: animejs-events
description: Anime.js Events and onScroll() reference covering ScrollObserver settings, thresholds, synchronisation modes, callbacks, methods, and properties. Use when syncing Anime.js behavior to scroll position and viewport entry or exit.
---

# Events Module

Trigger scroll-aware Anime.js behavior through the Events docs surface, which currently centers on `onScroll()` and the `ScrollObserver` it returns.

## Official reference

- Main page: <https://animejs.com/documentation/events/>
- Primary API page: <https://animejs.com/documentation/events/onscroll/>
- Coverage in this file: the Events landing page plus every official `onScroll()` subsection for settings, thresholds, synchronisation modes, callbacks, methods, and properties.

## Official section map

| Group | Section | URL |
|---|---|---|
| Core | Events | <https://animejs.com/documentation/events/> |
| Core | `onScroll()` | <https://animejs.com/documentation/events/onscroll/> |
| Settings | ScrollObserver settings | <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/> |
| Settings | `container` | <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/container/> |
| Settings | `target` | <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/target/> |
| Settings | `debug` | <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/debug/> |
| Settings | `axis` | <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/axis/> |
| Settings | `repeat` | <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/repeat/> |
| Thresholds | ScrollObserver thresholds | <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/> |
| Thresholds | Numeric values | <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/numeric-values/> |
| Thresholds | Positions shorthands | <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/positions-shorthands/> |
| Thresholds | Relative position values | <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/relative-position-values/> |
| Thresholds | Min max | <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/min-max/> |
| Sync | ScrollObserver synchronisation modes | <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/> |
| Sync | Method names | <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/method-names/> |
| Sync | Playback progress | <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/playback-progress/> |
| Sync | Smooth scroll | <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/smooth-scroll/> |
| Sync | Eased scroll | <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/eased-scroll/> |
| Callbacks | ScrollObserver callbacks | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/> |
| Callbacks | `onEnter` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onenter/> |
| Callbacks | `onEnterForward` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onenterforward/> |
| Callbacks | `onEnterBackward` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onenterbackward/> |
| Callbacks | `onLeave` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onleave/> |
| Callbacks | `onLeaveForward` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onleaveforward/> |
| Callbacks | `onLeaveBackward` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onleavebackward/> |
| Callbacks | `onUpdate` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onupdate/> |
| Callbacks | `onSyncComplete` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onsynccomplete/> |
| Callbacks | `onResize` | <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onresize/> |
| Methods | ScrollObserver methods | <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/> |
| Methods | `link()` | <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/link/> |
| Methods | `refresh()` | <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/refresh/> |
| Methods | `revert()` | <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/revert/> |
| Properties | ScrollObserver properties | <https://animejs.com/documentation/events/onscroll/scrollobserver-properties/> |

---

## Imports And Creation

The Events page documents three ways to reach the same API:

```javascript
import { events } from 'animejs';

events.onScroll();
```

```javascript
import { onScroll } from 'animejs';

const observer = onScroll(parameters);
```

```javascript
import { onScroll } from 'animejs/events';
```

Helpers used throughout the official examples:

```javascript
import {
  animate,
  createTimeline,
  createTimer,
  onScroll,
  stagger,
  utils,
} from 'animejs';
```

### Parameters

| Name | Accepts |
|---|---|
| `parameters` | An `Object` that mixes ScrollObserver settings, thresholds, synchronisation modes, and callbacks |

### Returns

`ScrollObserver`

The returned instance can be linked to one `Animation`, `Timer`, or `Timeline`, refreshed after dynamic threshold changes, inspected through runtime properties, and reverted to remove listeners.

---

## Events Page Summary

The Events landing page is a small index page. Its full purpose is to introduce event-listener helpers and point readers to `onScroll()` as the current documented Event utility.

Practical takeaway:

- `events.onScroll()` is the namespaced form
- `onScroll()` from `'animejs'` is the direct form
- `onScroll()` from `'animejs/events'` is the subpath form

---

## Shared Example Markup

Many of the fresh snippets below reuse this demo frame.

```html
<section class="event-demo">
  <aside class="event-status">
    <div class="status-card">
      <span class="status-label">phase</span>
      <strong class="status-value">idle</strong>
    </div>
    <div class="status-card">
      <span class="status-label">count</span>
      <strong class="status-count">0</strong>
    </div>
  </aside>

  <div class="event-viewport">
    <div class="event-track">
      <div class="event-panel intro">scroll</div>
      <div class="event-panel focus">
        <div class="event-bar"></div>
        <div class="event-dot"></div>
        <div class="event-dot"></div>
        <div class="event-dot"></div>
      </div>
      <div class="event-panel outro">keep going</div>
    </div>
  </div>
</section>
```

```css
.event-demo {
  display: grid;
  grid-template-columns: 180px minmax(280px, 540px);
  gap: 1.25rem;
  align-items: start;
  color: #f5efe4;
}

.event-status {
  display: grid;
  gap: 0.75rem;
  position: sticky;
  top: 1rem;
}

.status-card {
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: #18212f;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.status-label {
  display: block;
  font: 600 0.72rem/1.2 "Trebuchet MS", sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8fb7d8;
}

.status-value,
.status-count {
  display: block;
  margin-top: 0.35rem;
  font: 700 1.3rem/1.1 Georgia, serif;
}

.event-viewport {
  max-height: 22rem;
  overflow: auto;
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 24%),
    linear-gradient(160deg, #102033, #271d30 70%, #3a2220);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.event-track {
  display: grid;
  gap: 2rem;
  min-height: 52rem;
  padding: 2rem;
}

.event-panel {
  min-height: 14rem;
  display: grid;
  place-items: center;
  border-radius: 24px;
  color: #fff7ea;
  font: 700 1.2rem/1.1 Georgia, serif;
  text-transform: lowercase;
}

.intro,
.outro {
  background: rgba(255, 255, 255, 0.06);
}

.focus {
  position: relative;
  gap: 1rem;
  background: rgba(12, 19, 31, 0.78);
}

.event-bar {
  width: 5rem;
  height: 5rem;
  border-radius: 1.1rem;
  background: linear-gradient(135deg, #ffd166, #ff7b54);
}

.event-dot {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #8ecae6;
}

@media (max-width: 720px) {
  .event-demo {
    grid-template-columns: 1fr;
  }

  .event-status {
    position: static;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

---

## `onScroll()` At A Glance

The `onScroll()` page describes `ScrollObserver` as the bridge between scroll position and Anime.js playback. You can attach it directly inside `autoplay` or create it first and link an object later.

### Fresh `onScroll()` example

```javascript
import { animate, createTimer, createTimeline, onScroll, utils } from 'animejs';

const [viewport] = utils.$('.event-viewport');
const [$phase] = utils.$('.status-value');

animate('.event-bar', {
  x: '14rem',
  rotate: '1turn',
  alternate: true,
  loop: true,
  duration: 1800,
  autoplay: onScroll({
    container: viewport,
    debug: true,
    onEnter: () => ($phase.textContent = 'bar active'),
  }),
});

createTimer({
  duration: 1200,
  autoplay: onScroll({
    container: viewport,
    target: '.status-card:last-child',
    onEnter: () => ($phase.textContent = 'timer armed'),
  }),
});

createTimeline({
  autoplay: onScroll({
    container: viewport,
    target: '.focus',
    debug: true,
  }),
})
  .add('.event-dot:nth-of-type(1)', { x: '8rem' })
  .add('.event-dot:nth-of-type(2)', { x: '8rem' })
  .add('.event-dot:nth-of-type(3)', { x: '8rem' });
```

### Official section map

| Section | What it covers |
|---|---|
| Settings | Which element scrolls, which target is watched, whether markers appear, axis choice, and whether playback may repeat |
| Thresholds | How enter and leave points are described and defaulted |
| Synchronisation modes | Whether scrolling calls methods, drives progress exactly, smooths progress, or eases progress |
| Callbacks | Hook points for enter, leave, update, sync completion, and resize |
| Methods | Post-creation APIs on the observer |
| Properties | Runtime inspection values exposed by the observer |

---

## ScrollObserver Settings

Official settings page: <https://animejs.com/documentation/events/onscroll/scrollobserver-settings/>

Settings live directly inside the `onScroll()` parameter object.

```javascript
animate('.event-bar', {
  x: '10rem',
  autoplay: onScroll({
    container: '.event-viewport',
    target: '.focus',
    axis: 'y',
    enter: 'bottom top',
    leave: 'top bottom',
    sync: true,
  }),
});
```

### Settings reference

| Setting | Accepts | Default | Notes |
|---|---|---|---|
| `container` | CSS selector or DOM element | `null` | Scroll container that emits the scroll context |
| `target` | CSS selector or DOM element | First animation target when defined inline, otherwise `null` | Observed element whose position is evaluated |
| `debug` | `Boolean` | `false` | Shows threshold markers; Anime.js assigns each observer its own color |
| `axis` | `'x'` or `'y'` | `'y'` | Chooses horizontal or vertical measurement |
| `repeat` | `Boolean` | `true` | If `false`, the observer reverts itself after linked playback completes |

### `container`

Points `onScroll()` at the scrollable element to measure instead of assuming document scrolling.

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '12rem',
  rotate: '0.5turn',
  autoplay: onScroll({
    container: '.event-viewport',
  }),
});
```

### `target`

Overrides which element is used for threshold checks. Inline animation usage can infer the first animation target, but timers or standalone observers usually need this set explicitly.

```javascript
import { createTimer, onScroll } from 'animejs';

createTimer({
  duration: 1500,
  autoplay: onScroll({
    container: '.event-viewport',
    target: '.focus',
  }),
});
```

### `debug`

Enables visual guides for `enter` and `leave`. The docs note that the marker ruler shows container values on one side and target values on the other.

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '11rem',
  autoplay: onScroll({
    container: '.event-viewport',
    debug: true,
  }),
});
```

### `axis`

Switches from vertical tracking to horizontal tracking.

```html
<div class="event-viewport axis-x">
  <div class="event-track axis-track">
    <div class="event-panel intro">left</div>
    <div class="event-panel focus"><div class="event-bar"></div></div>
    <div class="event-panel outro">right</div>
  </div>
</div>
```

```css
.axis-x {
  overflow-x: auto;
  overflow-y: hidden;
}

.axis-track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 20rem;
  min-height: 16rem;
  min-width: 64rem;
}
```

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '13rem',
  autoplay: onScroll({
    container: '.axis-x',
    axis: 'x',
  }),
});
```

### `repeat`

Controls whether a completed sync can happen again on later passes. The official behavior note is important: `repeat: false` causes the observer to revert after completion.

```javascript
import { createTimer, onScroll, utils } from 'animejs';

const [$count] = utils.$('.status-count');
let passes = 0;

createTimer({
  duration: 900,
  autoplay: onScroll({
    container: '.event-viewport',
    target: '.focus',
    repeat: false,
    onUpdate: () => ($count.textContent = String(++passes)),
  }),
});
```

---

## ScrollObserver Thresholds

Official thresholds page: <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/>

Thresholds define the points at which the observed target is considered to have entered or left. The docs frame each threshold as a comparison between target and container start or end positions.

### Parameters and defaults

| Threshold key | Purpose | Default |
|---|---|---|
| `enter` | Start condition for observer entry | `'end start'` |
| `leave` | Exit condition for observer completion or pause | `'start end'` |

### Supported threshold syntaxes

The page documents three authoring styles:

```javascript
onScroll({
  enter: { target: 'top', container: 'bottom' },
  leave: { target: 'bottom', container: 'top' },
});
```

```javascript
onScroll({
  enter: 'bottom',
  leave: 'top',
});
```

```javascript
onScroll({
  enter: 'bottom top',
  leave: 'top bottom',
});
```

### Numeric values

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/numeric-values/>

Numeric thresholds define offsets from the top edge of the target or container. Unitless numbers are read as pixels.

| Type | Example | Meaning |
|---|---|---|
| Number | `100` | 100px from the top edge |
| Unit string | `'1rem'` | Unit-aware offset from the top edge |
| Percentage string | `'10%'` | Percentage of target or container height from the top edge |

Default unit: `px`

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '14rem',
  ease: 'inOutQuad',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: '75% 15%',
    leave: '40 -30',
    debug: true,
  }),
});
```

### Positions shorthands

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/positions-shorthands/>

Named positions let you write human-readable threshold pairs.

| Value | Meaning |
|---|---|
| `'top'` | Top y coordinate |
| `'bottom'` | Bottom y coordinate |
| `'left'` | Left x coordinate |
| `'right'` | Right x coordinate |
| `'center'` | Center coordinate on the active axis |
| `'start'` | `top` on y, `left` on x |
| `'end'` | `bottom` on y, `right` on x |

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '12rem',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'center top',
    leave: 'center bottom',
    debug: true,
  }),
});
```

### Relative position values

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/relative-position-values/>

Relative values build on Anime.js relative-value syntax and adjust a named position up, down, or by scale.

| Prefix | Effect | Example |
|---|---|---|
| `'+='` | Add | `'+=45'` |
| `'-='` | Subtract | `'-=50%'` |
| `'*='` | Multiply | `'*=.5'` |

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '13rem',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'center+=1rem top-=50%',
    leave: 'center-=1rem bottom+=50%',
    debug: true,
  }),
});
```

### Min max

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-thresholds/min-max/>

The docs position `min` and `max` as escape hatches for cases where an element starts too large or too small for ordinary enter and leave comparisons to behave well.

| Value | Meaning |
|---|---|
| `'min'` | Lowest possible value that can still satisfy the condition |
| `'max'` | Highest possible value that can still satisfy the condition |

```javascript
import { animate, onScroll, utils } from 'animejs';

utils.$('.event-dot').forEach((dot, index) => {
  animate(dot, {
    x: `${6 + index * 2}rem`,
    autoplay: onScroll({
      container: '.event-viewport',
      enter: 'max bottom',
      leave: 'min top',
      sync: true,
      debug: true,
    }),
  });
});
```

---

## ScrollObserver Synchronisation Modes

Official modes page: <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/>

The `sync` parameter decides whether scroll should call methods at threshold boundaries or continuously drive playback.

### Mode summary

| Mode | Accepts | Default or key note |
|---|---|---|
| Method names | Space-separated method string | Default is `'play pause'` |
| Playback progress | `true` or `1` | Exact scroll-to-progress mapping |
| Smooth scroll | Number from `0` to `1` | Lower values catch up more slowly |
| Eased scroll | Any Anime.js `ease` value | Progress is filtered through the easing |

### Method names

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/method-names/>

String mode maps callback phases to method calls on the linked object.

Callback order documented by the page:

- One method: `enter`
- Two methods: `enter leave`
- Four methods: `enterForward leaveForward enterBackward leaveBackward`

Default: `'play pause'`

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '14rem',
  duration: 1600,
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom-=40 top',
    leave: 'top+=40 bottom',
    sync: 'resume pause reverse reset',
    debug: true,
  }),
});
```

### Playback progress

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/playback-progress/>

`true` and `1` both mean exact progress matching between the observer and the linked object.

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '14rem',
  rotate: '1turn',
  ease: 'linear',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom-=30 top',
    leave: 'top+=50 bottom',
    sync: 1,
    debug: true,
  }),
});
```

### Smooth scroll

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/smooth-scroll/>

Numeric values between `0` and `1` create eased lag relative to the actual scroll position. Smaller numbers mean more catch-up delay.

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '14rem',
  rotate: '1turn',
  ease: 'linear',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom-=30 top',
    leave: 'top+=50 bottom',
    sync: 0.25,
    debug: true,
  }),
});
```

### Eased scroll

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-synchronisation-modes/eased-scroll/>

An ease name on `sync` reshapes the observer's progress before it is applied to playback.

```javascript
import { animate, onScroll, stagger } from 'animejs';

animate('.event-dot', {
  x: '9rem',
  delay: stagger(90, { from: 'last' }),
  ease: 'linear',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom-=30 top',
    leave: 'top+=50 bottom',
    sync: 'inOutCirc',
    debug: true,
  }),
});
```

---

## ScrollObserver Callbacks

Official callbacks page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/>

All ScrollObserver callbacks are supplied directly in the `onScroll()` options object.

```javascript
onScroll({
  container: '.event-viewport',
  onEnter: self => {},
  onLeave: self => {},
  onUpdate: self => {},
});
```

### Callback contract

All documented callbacks accept a `Function` whose first argument is the current `ScrollObserver` instance. Unless noted otherwise, the default is `noop`.

| Callback | When it runs | Official note |
|---|---|---|
| `onEnter` | Whenever the `enter` threshold is met | Direction-agnostic |
| `onEnterForward` | When `enter` is met while moving forward | Forward-only |
| `onEnterBackward` | When `enter` is met while moving backward | Backward-only |
| `onLeave` | Whenever the `leave` threshold is met | Direction-agnostic |
| `onLeaveForward` | When `leave` is met while moving forward | Forward-only |
| `onLeaveBackward` | When `leave` is met while moving backward | Backward-only |
| `onUpdate` | Whenever linked progress updates during synchronisation | Continuous hook |
| `onSyncComplete` | When linked synchronisation finishes | Completion hook |
| `onResize` | When the observer's container resizes | Added in docs as of Anime.js 4.3.3 |

### `onEnter`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onenter/>

```javascript
import { animate, onScroll, utils } from 'animejs';

const [$phase] = utils.$('.status-value');
const [$count] = utils.$('.status-count');
let enters = 0;

animate('.event-bar', {
  x: '13rem',
  ease: 'linear',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom-=40 top',
    leave: 'top+=60 bottom',
    sync: true,
    debug: true,
    onEnter: () => {
      $phase.textContent = 'entered';
      $count.textContent = String(++enters);
    },
  }),
});
```

### `onEnterForward`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onenterforward/>

```javascript
onScroll({
  container: '.event-viewport',
  target: '.focus',
  onEnterForward: self => {
    document.querySelector('.status-value').textContent = `forward @ ${self.scroll}`;
  },
});
```

### `onEnterBackward`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onenterbackward/>

```javascript
onScroll({
  container: '.event-viewport',
  target: '.focus',
  onEnterBackward: self => {
    document.querySelector('.status-value').textContent = `backward @ ${self.scroll}`;
  },
});
```

### `onLeave`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onleave/>

```javascript
onScroll({
  container: '.event-viewport',
  target: '.focus',
  onLeave: () => {
    const value = document.querySelector('.status-value');
    value.textContent = 'left';
  },
});
```

### `onLeaveForward`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onleaveforward/>

```javascript
onScroll({
  container: '.event-viewport',
  target: '.focus',
  onLeaveForward: self => {
    document.querySelector('.status-value').textContent = `forward exit ${self.progress.toFixed(2)}`;
  },
});
```

### `onLeaveBackward`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onleavebackward/>

```javascript
onScroll({
  container: '.event-viewport',
  target: '.focus',
  onLeaveBackward: self => {
    document.querySelector('.status-value').textContent = `backward exit ${self.progress.toFixed(2)}`;
  },
});
```

### `onUpdate`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onupdate/>

```javascript
import { animate, onScroll, utils } from 'animejs';

const [$count] = utils.$('.status-count');
let updates = 0;

animate('.event-bar', {
  x: '13rem',
  ease: 'linear',
  autoplay: onScroll({
    container: '.event-viewport',
    sync: 0.5,
    onUpdate: () => ($count.textContent = String(++updates)),
  }),
});
```

### `onSyncComplete`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onsynccomplete/>

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '13rem',
  ease: 'linear',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom top',
    leave: 'center bottom',
    sync: 0.5,
    debug: true,
    onSyncComplete: () => {
      document.querySelector('.status-value').textContent = 'complete';
    },
  }),
});
```

### `onResize`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-callbacks/onresize/>

Runs when the observer's container changes size. The official page marks this callback as available since Anime.js `4.3.3`.

```javascript
import { animate, onScroll, utils } from 'animejs';

const [$count] = utils.$('.status-count');
let resizes = 0;

animate('.event-bar', {
  x: '11rem',
  autoplay: onScroll({
    container: '.event-viewport',
    enter: 'bottom top',
    leave: 'center bottom',
    sync: 0.5,
    onResize: () => ($count.textContent = String(++resizes)),
  }),
});
```

---

## ScrollObserver Methods

Official methods page: <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/>

The observer returned by `onScroll()` exposes three documented instance methods.

| Method | Parameters | Returns | Summary |
|---|---|---|---|
| `link(linked)` | `Animation`, `Timer`, or `Timeline` | The observer itself | Attaches one linked object; later calls replace the previous link |
| `refresh()` | None | The observer itself | Recomputes bounds and any function-based `repeat`, `axis`, `enter`, or `leave` values |
| `revert()` | None | The observer itself | Removes listeners and destroys debug UI if present |

### `link()`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/link/>

Use `link()` when you want to build the observer separately instead of declaring it in `autoplay`.

```javascript
import { animate, onScroll } from 'animejs';

const pulse = animate('.event-bar', {
  x: '12rem',
  rotate: '1turn',
  ease: 'linear',
  autoplay: false,
});

const observer = onScroll({
  container: '.event-viewport',
  enter: 'bottom-=40 top',
  leave: 'top+=40 bottom',
  sync: true,
  debug: true,
});

observer.link(pulse);
```

### `refresh()`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/refresh/>

The docs specifically call out function-based `repeat`, `axis`, `enter`, and `leave` as refreshable inputs.

```javascript
import { animate, onScroll } from 'animejs';

const offsets = { enter: 30, leave: 50 };

const observer = onScroll({
  container: '.event-viewport',
  enter: () => `bottom-=${offsets.enter} top`,
  leave: () => `top+=${offsets.leave} bottom`,
  sync: 0.5,
  debug: true,
});

animate('.event-bar', {
  x: '12rem',
  autoplay: observer,
});

offsets.enter = 60;
offsets.leave = 20;
observer.refresh();
```

### `revert()`

Official page: <https://animejs.com/documentation/events/onscroll/scrollobserver-methods/revert/>

`revert()` is the cleanup path. It disables the observer and removes its listeners.

```javascript
import { animate, onScroll } from 'animejs';

animate('.event-bar', {
  x: '12rem',
  autoplay: onScroll({
    container: '.event-viewport',
    sync: 1,
    debug: true,
    onSyncComplete: self => self.revert(),
  }),
});
```

---

## ScrollObserver Properties

Official properties page: <https://animejs.com/documentation/events/onscroll/scrollobserver-properties/>

The properties page is a single table rather than a set of per-property subpages. These fields let you inspect the observer at runtime:

| Property | Type | Meaning |
|---|---|---|
| `id` | `Number` | Unique observer identifier |
| `container` | `ScrollContainer` | Scroll container tied to the observer |
| `target` | `HTMLElement` | Current observed element |
| `linked` | `Animation \| Timer \| Timeline` | Currently linked object |
| `repeat` | `Boolean` | Whether repeat behavior is enabled |
| `horizontal` | `Boolean` | Whether tracking is happening on the x axis |
| `enter` | `String \| Number` | Current enter threshold |
| `leave` | `String \| Number` | Current leave threshold; the docs note this one can also be set |
| `sync` | `Boolean` | Whether synchronisation is active |
| `velocity` | `Number` | Current scroll velocity |
| `backward` | `Boolean` | Whether the current scroll direction is backward |
| `scroll` | `Number` | Current scroll position |
| `progress` | `Number` | Target progress from `0` to `1` |
| `completed` | `Boolean` | Whether the observation has completed |
| `began` | `Boolean` | Whether the observation has started |
| `isInView` | `Boolean` | Whether the target is currently within the observed range |
| `offset` | `Number` | Current target offset |
| `offsetStart` | `Number` | Start offset for the target |
| `offsetEnd` | `Number` | End offset for the target |
| `distance` | `Number` | Total scroll distance for the target |

### Property inspection example

```javascript
import { animate, onScroll } from 'animejs';

const observer = onScroll({
  container: '.event-viewport',
  target: '.focus',
  sync: true,
  onUpdate: self => {
    document.querySelector('.status-value').textContent =
      `${self.backward ? 'backward' : 'forward'} ${self.progress.toFixed(2)}`;
  },
});

animate('.event-bar', {
  x: '12rem',
  autoplay: observer,
});
```

---

## Practical Rules Of Thumb

- Reach for `sync: true` or `sync: 1` when scroll position itself should be the timeline.
- Reach for numeric `sync` values when you want scroll-following with visible lag.
- Reach for string `sync` values when threshold crossings should call lifecycle methods rather than map progress.
- Set `target` explicitly for timers, standalone observers, or when the watched element should differ from the animated element.
- Use `refresh()` after changing function-based thresholds at runtime.
- Use `revert()` when a once-only observer should clean itself up.
