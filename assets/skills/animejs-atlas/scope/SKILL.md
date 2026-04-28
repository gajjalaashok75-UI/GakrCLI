---
name: animejs-scope
description: Anime.js Scope reference covering createScope(), constructor registration, method registration, parameters, methods, and properties. Use when isolating Anime.js behavior inside reusable components, especially in React-style setups.
---

# Anime.js Scope Docs Companion

Official page: <https://animejs.com/documentation/scope/>

This file is a section-complete, paraphrased companion to the official Anime.js Scope docs and every Scope subsection linked from that page. It covers:

- `createScope()` imports, signature, parameters, and return value
- Add constructor function
- Register method function
- Scope parameters
- Scope methods
- Scope properties

Use this as a practical map of the official material, not a replacement for it.

## Official section map

### Direct subsection links

| Group | Section | Official link |
| --- | --- | --- |
| Core | Scope | <https://animejs.com/documentation/scope/> |
| Core | Add constructor function | <https://animejs.com/documentation/scope/add-constructor-function/> |
| Core | Register method function | <https://animejs.com/documentation/scope/register-method-function/> |
| Parameters | Scope parameters | <https://animejs.com/documentation/scope/scope-parameters/> |
| Parameters | `root` | <https://animejs.com/documentation/scope/scope-parameters/root/> |
| Parameters | `defaults` | <https://animejs.com/documentation/scope/scope-parameters/defaults/> |
| Parameters | `mediaQueries` | <https://animejs.com/documentation/scope/scope-parameters/mediaqueries/> |
| Methods | Scope methods | <https://animejs.com/documentation/scope/scope-methods/> |
| Methods | `add()` | <https://animejs.com/documentation/scope/scope-methods/add/> |
| Methods | `addOnce()` | <https://animejs.com/documentation/scope/scope-methods/addonce/> |
| Methods | `keepTime()` | <https://animejs.com/documentation/scope/scope-methods/keeptime/> |
| Methods | `revert()` | <https://animejs.com/documentation/scope/scope-methods/revert/> |
| Methods | `refresh()` | <https://animejs.com/documentation/scope/scope-methods/refresh/> |
| Properties | Scope properties | <https://animejs.com/documentation/scope/scope-properties/> |

## Imports, signature, parameters, returns

Official references:

- Main page: <https://animejs.com/documentation/scope/>
- Parameters overview: <https://animejs.com/documentation/scope/scope-parameters/>
- Methods overview: <https://animejs.com/documentation/scope/scope-methods/>
- Properties page: <https://animejs.com/documentation/scope/scope-properties/>

Primary imports:

```js
import { createScope } from 'animejs';
import { createScope as createScopeOnly } from 'animejs/scope';
import {
  animate,
  createDraggable,
  createTimeline,
  createTimer,
  stagger,
  utils,
} from 'animejs';
```

Core signature:

```js
const scope = createScope(parameters);
```

Official parameter contract:

| Name | Accepts |
| --- | --- |
| `parameters` | Optional [Scope parameters](https://animejs.com/documentation/scope/scope-parameters/) object |

Official return:

- `createScope()` returns `Scope`

The returned instance gives you a scoped execution context for Anime.js objects, DOM lookups, responsive rebuilds, externally callable methods, and bulk teardown.

## Quick start example

This example follows the same core idea as the main docs page: scope-aware animation that changes behavior when media queries flip.

```html
<section class="scope-hero">
  <div class="scope-stage">
    <div class="scope-square"></div>
  </div>
</section>
```

```css
.scope-hero {
  padding: 2rem;
  background: linear-gradient(135deg, #0f172a, #1e293b);
}

.scope-stage {
  min-height: 14rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 1rem;
  background: radial-gradient(circle at top, #1d4ed8, #0f172a 60%);
}

.scope-square {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #f97316, #fb7185);
}
```

```js
import { animate, createScope, utils } from 'animejs';

createScope({
  root: '.scope-stage',
  mediaQueries: {
    compact: '(max-width: 640px)',
    reduceMotion: '(prefers-reduced-motion)',
  },
})
.add(self => {
  const { compact, reduceMotion } = self.matches;

  utils.set('.scope-square', {
    scale: compact ? 0.8 : 1,
  });

  animate('.scope-square', {
    x: compact ? 0 : ['-8rem', '8rem'],
    y: compact ? ['-4rem', '4rem'] : 0,
    rotate: '1turn',
    loop: true,
    alternate: true,
    duration: reduceMotion ? 0 : compact ? 700 : 1200,
  });
});
```

## Shared example scaffold

Most later snippets can reuse this markup and CSS.

```html
<section class="scope-lab">
  <div class="controls">
    <button class="launch-btn">Launch</button>
    <button class="refresh-btn">Refresh</button>
    <button class="revert-btn">Revert</button>
  </div>

  <div class="lane lane-a">
    <div class="token"></div>
    <div class="token"></div>
    <div class="token"></div>
    <span class="label">lane A</span>
  </div>

  <div class="lane lane-b">
    <div class="token"></div>
    <div class="token"></div>
    <div class="token"></div>
    <span class="label">lane B</span>
  </div>

  <div class="orb-panel">
    <div class="orb"></div>
  </div>

  <pre class="scope-log">idle</pre>
</section>
```

```css
.scope-lab {
  display: grid;
  gap: 1rem;
  max-width: 42rem;
  margin: 2rem auto;
  padding: 1.25rem;
  border-radius: 1.25rem;
  background: #f8fafc;
  color: #0f172a;
  font: 14px/1.45 "Segoe UI", sans-serif;
  box-shadow: 0 18px 45px rgb(15 23 42 / 0.12);
}

.controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.controls button {
  flex: 1 1 8rem;
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 999px;
  background: #0f172a;
  color: #f8fafc;
  cursor: pointer;
}

.lane,
.orb-panel {
  position: relative;
  min-height: 5rem;
  padding: 1rem;
  border-radius: 1rem;
  overflow: hidden;
}

.lane {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  background: linear-gradient(135deg, #dbeafe, #eff6ff);
}

.lane-b {
  background: linear-gradient(135deg, #dcfce7, #f0fdf4);
}

.token,
.orb {
  width: 2.5rem;
  height: 2.5rem;
}

.token {
  border-radius: 0.8rem;
  background: linear-gradient(135deg, #38bdf8, #2563eb);
}

.orb-panel {
  display: grid;
  place-items: center;
  background: radial-gradient(circle at top, #111827, #020617 70%);
}

.orb {
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, #fef08a, #f97316 70%);
  box-shadow: 0 0 40px rgb(249 115 22 / 0.45);
}

.label {
  margin-left: auto;
  font-weight: 600;
  color: #334155;
}

.scope-log {
  margin: 0;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  background: #e2e8f0;
  color: #0f172a;
}
```

## Add constructor function

Official page: <https://animejs.com/documentation/scope/add-constructor-function/>

Constructor callbacks are the heart of a scope. When you pass one into `add()` or `addOnce()`, Anime.js runs it inside that scope's context and tracks the Anime.js objects created there. That tracking includes animations, timers, timelines, animatables, draggables, scroll observers, and even nested scopes created from inside the callback.

Core forms:

```js
scope.add(constructor);
scope.addOnce(constructor);
```

Constructor callback contract:

| Name | Type | Notes |
| --- | --- | --- |
| `self` | `Scope` | The active scope instance |

Optional return:

- A cleanup `Function` that runs when the scope is reverted or rebuilt after a media-query change

Fresh example:

```js
import { animate, createScope, utils } from 'animejs';

createScope({
  root: '.scope-lab',
  mediaQueries: {
    compact: '(max-width: 640px)',
  },
  defaults: {
    ease: 'inOut(3)',
  },
})
.add(self => {
  const { compact } = self.matches;
  const chips = utils.$('.token');

  chips.forEach((chip, index) => {
    animate(chip, {
      y: compact ? 0 : [-10, 10],
      rotate: compact ? 0 : '1turn',
      loop: true,
      alternate: true,
      delay: index * 120,
      duration: 700,
    });
  });

  const onEnter = event => {
    animate(event.currentTarget, {
      scale: [1, 1.18, 1],
      duration: 350,
    });
  };

  chips.forEach(chip => chip.addEventListener('mouseenter', onEnter));

  return () => {
    chips.forEach(chip => chip.removeEventListener('mouseenter', onEnter));
  };
});
```

## Register method function

Official page: <https://animejs.com/documentation/scope/register-method-function/>

You can also use `scope.add()` to register named methods instead of constructors. The name becomes a key on `scope.methods`, which lets outside code trigger scoped behavior without losing access to the scope state.

Core form:

```js
scope.add('methodName', methodFunction);
scope.methods.methodName(...args);
```

Method arguments:

| Name | Type |
| --- | --- |
| `...args` | `Any` |

Fresh example:

```js
import { animate, createScope, utils } from 'animejs';

const scope = createScope({
  root: '.scope-lab',
  mediaQueries: {
    compact: '(max-width: 640px)',
  },
})
.add(self => {
  self.add('launchFromButton', event => {
    const log = document.querySelector('.scope-log');
    const compact = self.matches.compact;
    const distance = compact ? 0 : 140;

    animate('.orb', {
      x: compact ? 0 : [-distance, distance],
      y: compact ? [-50, 50] : 0,
      rotate: compact ? '1turn' : '.5turn',
      duration: compact ? 800 : 500,
    });

    log.textContent = `launch from ${event.currentTarget.textContent}`;
  });

  utils.set('.launch-btn', {
    opacity: self.matches.compact ? 0.85 : 1,
  });
});

document
  .querySelector('.launch-btn')
  .addEventListener('click', scope.methods.launchFromButton);
```

## Scope parameters

Official overview: <https://animejs.com/documentation/scope/scope-parameters/>

The docs group Scope configuration into three keys:

| Parameter | Accepts | Purpose |
| --- | --- | --- |
| `root` | CSS selector or DOM element | Limits DOM work to a subtree |
| `defaults` | Object | Supplies shared defaults to timers, animations, and timelines created in the scope |
| `mediaQueries` | Object | Declares responsive conditions and triggers rebuilds when their match state changes |

Overview example:

```js
createScope({
  root: '.scope-lab',
  defaults: {
    duration: 600,
    ease: 'out(3)',
  },
  mediaQueries: {
    compact: '(max-width: 640px)',
    reduceMotion: '(prefers-reduced-motion)',
  },
})
.add(self => {
  animate('.orb', {
    x: self.matches.compact ? 0 : '10rem',
    y: self.matches.compact ? '4rem' : 0,
    duration: self.matches.reduceMotion ? 0 : 600,
  });
});
```

### `root`

Official page: <https://animejs.com/documentation/scope/scope-parameters/root/>

`root` defines the DOM boundary used by scoped queries and related utilities. The official docs frame it as a way to keep animation behavior local to one component or subtree instead of the whole document.

Accepts:

- CSS selector
- DOM element

Fresh example:

```js
import { animate, createScope } from 'animejs';

createScope({ root: '.lane-b' })
.add(() => {
  animate('.token', {
    x: '9rem',
    loop: true,
    alternate: true,
    duration: 650,
  });
});
```

In that setup, only the `.token` elements inside `.lane-b` are affected.

### `defaults`

Official page: <https://animejs.com/documentation/scope/scope-parameters/defaults/>

`defaults` supplies shared settings to every timer, animation, and timeline created from inside the scope. It is a good fit when a component wants one consistent motion style without repeating the same options everywhere.

Accepted keys listed on the official page:

| Key | Accepts |
| --- | --- |
| `playbackEase` | Easing name `String` or easing `Function` |
| `playbackRate` | `Number` |
| `frameRate` | `Number` |
| `loop` | `Number` or `Boolean` |
| `reversed` | `Boolean` |
| `alternate` | `Boolean` |
| `autoplay` | `Boolean` |
| `duration` | `Number` or `Function` |
| `delay` | `Number` or `Function` |
| `composition` | Composition name `String` or `Function` |
| `ease` | Easing name `String` or easing `Function` |
| `loopDelay` | `Number` |
| `modifier` | `Function` |
| `onBegin` | Callback `Function` |
| `onUpdate` | Callback `Function` |
| `onRender` | Callback `Function` |
| `onLoop` | Callback `Function` |
| `onComplete` | Callback `Function` |

Fresh example:

```js
import { animate, createScope } from 'animejs';

document.querySelectorAll('.lane').forEach((lane, index) => {
  createScope({
    root: lane,
    defaults: {
      duration: 700,
      ease: `out(${index + 2})`,
      alternate: true,
      loop: true,
    },
  })
  .add(() => {
    animate('.token', {
      x: '8rem',
    });
  });
});
```

### `mediaQueries`

Official page: <https://animejs.com/documentation/scope/scope-parameters/mediaqueries/>

`mediaQueries` lets a scope track responsive conditions. Each key becomes a flag on `scope.matches`, and the scope refreshes itself when any declared query changes state.

Accepts:

| Part | Accepts |
| --- | --- |
| Query name | Arbitrary `String` key |
| Query definition | Media query `String` |

Fresh example:

```js
import { animate, createScope, utils } from 'animejs';

createScope({
  root: '.scope-lab',
  mediaQueries: {
    small: '(max-width: 480px)',
    medium: '(min-width: 481px) and (max-width: 820px)',
    large: '(min-width: 821px)',
    reduceMotion: '(prefers-reduced-motion)',
  },
})
.add(self => {
  const { small, medium, large, reduceMotion } = self.matches;

  utils.set('.orb', {
    scale: small ? 0.75 : medium ? 1 : 1.2,
  });

  animate('.orb', {
    x: small ? 0 : large ? ['-10rem', '10rem'] : ['-5rem', '5rem'],
    y: small ? ['-4rem', '4rem'] : 0,
    rotate: 360,
    loop: true,
    alternate: true,
    duration: reduceMotion ? 0 : small ? 700 : 1100,
  });
});
```

## Scope methods

Official overview: <https://animejs.com/documentation/scope/scope-methods/>

The Scope instance exposes five documented methods:

| Method | Parameters | Returns | Purpose |
| --- | --- | --- | --- |
| `add()` | Constructor or name plus method | `Scope` | Register a constructor or a named method |
| `addOnce()` | Constructor | `Scope` | Run a constructor once and keep its work across media-query changes |
| `keepTime()` | Constructor returning timer, animation, or timeline | `Scope` | Rebuild motion while preserving the current playhead time |
| `revert()` | none | `Scope` | Tear down registered work and run cleanup callbacks |
| `refresh()` | none | `Scope` | Revert then rebuild by re-running constructors |

### `add()`

Official page: <https://animejs.com/documentation/scope/scope-methods/add/>

`add()` is overloaded. You can either attach a constructor callback or store a named method for outside callers.

| Overload | Parameters | Returns |
| --- | --- | --- |
| `scope.add(constructor)` | `constructor`: constructor `Function` | `Scope` |
| `scope.add(name, method)` | `name`: `String`, `method`: method `Function` | `Scope` |

Fresh example:

```js
import { animate, createScope } from 'animejs';

const scope = createScope({ root: '.scope-lab' })
  .add(() => {
    animate('.orb', {
      scale: [0.9, 1.1, 1],
      duration: 800,
      loop: true,
    });
  })
  .add('nudge', amount => {
    animate('.orb', {
      x: [0, amount, 0],
      duration: 300,
    });
  });

scope.methods.nudge(48);
```

### `addOnce()`

Official page: <https://animejs.com/documentation/scope/scope-methods/addonce/>

`addOnce()` is for constructor work that should happen exactly one time, even if the scope later rebuilds because media queries changed. The official page also warns not to call `addOnce()` conditionally, because that breaks the bookkeeping needed to know whether a callback already ran.

Core form:

```js
scope.addOnce(constructor);
```

Parameter contract:

| Name | Accepts |
| --- | --- |
| `constructor` | Constructor `Function` |

Returns:

- The `Scope` itself

Fresh example:

```js
import { animate, createScope, stagger } from 'animejs';

createScope({
  root: '.scope-lab',
  mediaQueries: {
    compact: '(max-width: 640px)',
  },
})
.add(self => {
  self.addOnce(() => {
    animate('.token', {
      backgroundColor: ['#38bdf8', '#22c55e'],
      loop: true,
      alternate: true,
      duration: 1800,
      delay: stagger(120),
    });
  });

  self.add(() => {
    animate('.token', {
      x: self.matches.compact ? [-16, 16] : [-56, 56],
      scale: [0.92, 1.08],
      loop: true,
      alternate: true,
      delay: stagger(80),
      duration: 900,
    });
  });
});
```

### `keepTime()`

Official page: <https://animejs.com/documentation/scope/scope-methods/keeptime/>

`keepTime()` is designed for responsive rebuilds where you want updated parameters but do not want the playhead to snap back to the beginning. The callback must return a timer, animation, or timeline so Anime.js can recreate it and preserve time across media-query transitions.

Core form:

```js
scope.keepTime(() => animate(target, parameters));
```

Parameter contract:

| Name | Accepts |
| --- | --- |
| `constructor` | `Function` returning a `Timer`, `Animation`, or `Timeline` |

Returns:

- The `Scope` itself

Fresh example:

```js
import { animate, createScope } from 'animejs';

createScope({
  root: '.scope-lab',
  mediaQueries: {
    compact: '(max-width: 640px)',
  },
})
.add(self => {
  self.keepTime(() => animate('.orb', {
    x: self.matches.compact ? [-24, 24] : [-120, 120],
    scale: [0.85, 1.15],
    loop: true,
    alternate: true,
    duration: 1500,
  }));
});
```

### `revert()`

Official page: <https://animejs.com/documentation/scope/scope-methods/revert/>

`revert()` shuts down the Anime.js objects that were declared inside the scope and then runs any cleanup functions returned by your constructors. Use it when a component is leaving the page or you need to fully reset a scoped motion setup.

Returns:

- The `Scope` itself

Fresh example:

```js
import { animate, createScope, utils } from 'animejs';

const scope = createScope({ root: '.scope-lab' }).add(() => {
  const chips = utils.$('.token');

  const onEnter = event => {
    animate(event.currentTarget, {
      scale: [1, 1.25, 1],
      duration: 280,
    });
  };

  chips.forEach((chip, index) => {
    animate(chip, {
      opacity: [0.35, 1],
      loop: true,
      alternate: true,
      delay: index * 100,
      duration: 500,
    });

    chip.addEventListener('mouseenter', onEnter);
  });

  return () => {
    chips.forEach(chip => chip.removeEventListener('mouseenter', onEnter));
  };
});

document
  .querySelector('.revert-btn')
  .addEventListener('click', () => scope.revert());
```

### `refresh()`

Official page: <https://animejs.com/documentation/scope/scope-methods/refresh/>

`refresh()` rebuilds the scope by reverting it and then running each constructor again. The docs also note that Anime.js calls `refresh()` internally whenever one of the scope's media queries changes match state.

Returns:

- The `Scope` itself

Fresh example:

```js
import { createScope, createTimeline, stagger, utils } from 'animejs';

const scope = createScope({ root: '.scope-lab' }).add(self => {
  const chips = utils.$('.token');
  const nextIndex = ((self.data.focusIndex ?? -1) + 1) % chips.length;

  self.data.focusIndex = nextIndex;

  utils.set(chips, {
    opacity: (_, index) => index === nextIndex ? 1 : 0.35,
  });

  createTimeline()
    .add(chips, {
      y: [{ to: -14, duration: 220 }, { to: 0, duration: 480 }],
      delay: stagger(90, { from: nextIndex }),
    })
    .seek(700);
});

document
  .querySelector('.refresh-btn')
  .addEventListener('click', () => scope.refresh());
```

## Scope properties

Official page: <https://animejs.com/documentation/scope/scope-properties/>

The properties page is a single table describing the members on a `Scope` instance returned by `createScope()`.

| Property | Type | Meaning |
| --- | --- | --- |
| `data` | `Object` | Scratch storage tied to the scope; values placed here are cleared when the scope reverts |
| `defaults` | `Object` | The resolved default parameters for this scope |
| `root` | `Document \| HTMLElement` | The DOM root used for scoped operations |
| `constructors` | `Array<Function>` | The constructor callbacks registered on the scope |
| `revertConstructors` | `Array<Function>` | Cleanup callbacks collected from constructors |
| `revertibles` | `Array<Tickable \| Animatable \| Draggable \| ScrollObserver \| Scope>` | Anime.js objects created in the scope that can be reverted later |
| `methods` | `Object` | The named methods registered through `scope.add(name, method)` |
| `matches` | `Object` | Current media-query match flags |
| `mediaQueryLists` | `Object` | Backing `MediaQueryList` objects for declared queries |

Fresh example:

```js
import { createScope } from 'animejs';

const scope = createScope({
  root: '.scope-lab',
  mediaQueries: {
    compact: '(max-width: 640px)',
  },
})
.add(self => {
  self.data.createdAt ??= Date.now();

  self.add('inspect', () => {
    console.table({
      rootType: self.root?.constructor?.name,
      constructorCount: self.constructors.length,
      cleanupCount: self.revertConstructors.length,
      revertibleCount: self.revertibles.length,
      compact: self.matches.compact,
      createdAt: self.data.createdAt,
    });
  });
});

scope.methods.inspect();
```

## Practical takeaways

- Reach for `root` when a component should only animate its own DOM subtree.
- Reach for `defaults` when many child animations inside one component share timing or easing.
- Reach for `mediaQueries` when the same component should rebuild itself responsively.
- Use constructor cleanup functions for non-Anime.js side effects such as DOM event listeners.
- Use `addOnce()` for one-time scoped work that should survive responsive rebuilds.
- Use `keepTime()` when a media-query change should adjust motion parameters without restarting playback from zero.
- Use `revert()` when the component is being torn down.
- Use `refresh()` when you need to manually rebuild the scope with fresh constructor output.
