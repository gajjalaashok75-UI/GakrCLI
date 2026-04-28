---
name: animejs-engine
description: Anime.js engine reference covering global parameters, methods, properties, and engine defaults. Use when tuning app-wide Anime.js timing, frame pacing, visibility pausing, or shared motion defaults.
---

# Engine Module

Anime.js exposes a single shared engine for global timing, frame pacing, tab-visibility behavior, and cross-project defaults. This companion follows the official Engine docs page and rewrites each section in plain language with fresh examples.

## Official reference

- Main page: <https://animejs.com/documentation/engine/>
- Engine parameters hub: <https://animejs.com/documentation/engine/engine-parameters/>
- Engine methods hub: <https://animejs.com/documentation/engine/engine-methods/>
- Engine properties page: <https://animejs.com/documentation/engine/engine-properties/>
- Engine defaults page: <https://animejs.com/documentation/engine/engine-defaults/>

## Official section map

### Parameters

- `timeUnit`: <https://animejs.com/documentation/engine/engine-parameters/timeunit-seconds-milliseconds/>
- `speed`: <https://animejs.com/documentation/engine/engine-parameters/speed/>
- `fps`: <https://animejs.com/documentation/engine/engine-parameters/fps/>
- `precision`: <https://animejs.com/documentation/engine/engine-parameters/precision/>
- `pauseOnDocumentHidden`: <https://animejs.com/documentation/engine/engine-parameters/pauseondocumenthidden/>

### Methods

- `update()`: <https://animejs.com/documentation/engine/engine-methods/update/>
- `pause()`: <https://animejs.com/documentation/engine/engine-methods/pause/>
- `resume()`: <https://animejs.com/documentation/engine/engine-methods/resume/>

### Properties

- `Engine properties`: <https://animejs.com/documentation/engine/engine-properties/>

### Engine defaults

- `Engine defaults`: <https://animejs.com/documentation/engine/engine-defaults/>

---

## Imports

The Engine docs import the shared engine from the main package:

```js
import { engine } from 'animejs';
```

When an example also creates a timer or animation, import those APIs beside `engine`:

```js
import { animate, createTimer, engine } from 'animejs';
```

## What the engine is for

Reach for `engine` when the change should affect many Anime.js instances at once instead of one timer, animation, or timeline:

- global playback speed
- global frame-rate cap
- global time unit
- app-wide pause and resume
- shared default playback and callback settings

---

## Engine parameters

Engine parameters are mutable settings on the shared `engine` object.

```js
engine.speed = 0.75;
engine.fps = 60;
engine.pauseOnDocumentHidden = true;
```

### timeUnit

Docs: <https://animejs.com/documentation/engine/engine-parameters/timeunit-seconds-milliseconds/>

- Accepts: `'ms'` or `'s'`
- Default: `'ms'`
- Notes:
  - This switches whether Anime.js interprets timing values as milliseconds or seconds.
  - Changing it also updates the engine's default duration baseline.
  - The docs show switching it before creating a timer so later timings inherit the chosen unit.

```html
<section class="engine-time-unit">
  <button type="button" class="toggle">Switch to seconds</button>
  <p>Unit: <output class="unit">ms</output></p>
  <p>Timer time: <output class="time">0</output></p>
</section>
```

```css
.engine-time-unit {
  display: grid;
  gap: 0.45rem;
  width: 15rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #0f172a;
}

.engine-time-unit button {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #0f172a;
  color: #fff;
}

.engine-time-unit output {
  font: 700 0.95rem/1 monospace;
}
```

```js
import { createTimer, engine } from 'animejs';

const button = document.querySelector('.engine-time-unit .toggle');
const unit = document.querySelector('.engine-time-unit .unit');
const time = document.querySelector('.engine-time-unit .time');

let timer = createTimer({
  duration: 1200,
  onUpdate: self => {
    time.textContent = String(Number(self.currentTime).toFixed(2));
  }
});

button.addEventListener('click', () => {
  timer.cancel();
  engine.timeUnit = engine.timeUnit === 'ms' ? 's' : 'ms';
  unit.textContent = engine.timeUnit;
  button.textContent = engine.timeUnit === 'ms' ? 'Switch to seconds' : 'Switch to milliseconds';

  timer = createTimer({
    duration: engine.timeUnit === 'ms' ? 1200 : 1.2,
    onUpdate: self => {
      time.textContent = String(Number(self.currentTime).toFixed(2));
    }
  });
});
```

### speed

Docs: <https://animejs.com/documentation/engine/engine-parameters/speed/>

- Accepts: any number greater than or equal to `0`
- Default: `1`
- Use it to slow down or speed up every engine-driven instance without rewriting per-instance durations.

```html
<section class="engine-speed">
  <label>Speed <input class="range" type="range" min="0" max="3" step="0.1" value="1" /></label>
  <p>Global speed: <output class="value">1.0</output>x</p>
  <div class="dot"></div>
</section>
```

```css
.engine-speed {
  display: grid;
  gap: 0.5rem;
  width: 16rem;
  padding: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  color: #1d4ed8;
}

.engine-speed .dot {
  width: 1rem;
  height: 1rem;
  border-radius: 999px;
  background: #2563eb;
}
```

```js
import { animate, engine } from 'animejs';

const slider = document.querySelector('.engine-speed .range');
const value = document.querySelector('.engine-speed .value');

animate('.engine-speed .dot', {
  x: '14rem',
  duration: 1600,
  alternate: true,
  loop: true,
  ease: 'inOutSine'
});

slider.addEventListener('input', () => {
  engine.speed = Number(slider.value);
  value.textContent = slider.value;
});
```

### fps

Docs: <https://animejs.com/documentation/engine/engine-parameters/fps/>

- Accepts: any number greater than `0`
- Default: `120`
- Notes:
  - This caps how often the engine advances.
  - The browser and display refresh rate can still limit the real visible update rate.

```html
<section class="engine-fps">
  <label>FPS <input class="range" type="range" min="1" max="120" value="120" /></label>
  <p>Engine fps: <output class="value">120</output></p>
  <p>Update hits: <output class="hits">0</output></p>
</section>
```

```css
.engine-fps {
  display: grid;
  gap: 0.45rem;
  width: 16rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #f0fdf4;
  color: #166534;
}

.engine-fps output {
  font: 700 0.95rem/1 monospace;
}
```

```js
import { createTimer, engine } from 'animejs';

const slider = document.querySelector('.engine-fps .range');
const value = document.querySelector('.engine-fps .value');
const hits = document.querySelector('.engine-fps .hits');

let count = 0;

createTimer({
  onUpdate: () => {
    count += 1;
    hits.textContent = String(count);
  }
});

slider.addEventListener('input', () => {
  engine.fps = Number(slider.value);
  value.textContent = slider.value;
  count = 0;
  hits.textContent = '0';
});
```

### precision

Docs: <https://animejs.com/documentation/engine/engine-parameters/precision/>

- Accepts: any number greater than or equal to `0`, or any number lower than `0` to disable rounding
- Default: `4`
- Use it when tiny floating-point differences matter, especially in long-running or highly granular motion.

```html
<section class="engine-precision">
  <button type="button" class="toggle">Disable rounding</button>
  <p>Precision: <output class="value">4</output></p>
  <p>Sample value: <output class="sample">0</output></p>
</section>
```

```css
.engine-precision {
  display: grid;
  gap: 0.45rem;
  width: 16rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #fff7ed;
  color: #9a3412;
}

.engine-precision button {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #c2410c;
  color: #fff;
}
```

```js
import { createTimer, engine } from 'animejs';

const button = document.querySelector('.engine-precision .toggle');
const value = document.querySelector('.engine-precision .value');
const sample = document.querySelector('.engine-precision .sample');

createTimer({
  duration: 2000,
  loop: true,
  onUpdate: self => {
    sample.textContent = String(self.progress / 3);
  }
});

button.addEventListener('click', () => {
  engine.precision = engine.precision < 0 ? 4 : -1;
  value.textContent = String(engine.precision);
  button.textContent = engine.precision < 0 ? 'Use 4 decimals' : 'Disable rounding';
});
```

### pauseOnDocumentHidden

Docs: <https://animejs.com/documentation/engine/engine-parameters/pauseondocumenthidden/>

- Accepts: `Boolean`
- Default: `true`
- Notes:
  - When enabled, Anime.js pauses engine work while the page is hidden.
  - When disabled, time keeps advancing in the background and the engine catches up after the document becomes visible again.

```html
<section class="engine-visibility">
  <button type="button" class="toggle">Keep pausing in hidden tabs</button>
  <p>pauseOnDocumentHidden: <output class="value">true</output></p>
  <p>Current time: <output class="time">0</output></p>
</section>
```

```css
.engine-visibility {
  display: grid;
  gap: 0.45rem;
  width: 17rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #faf5ff;
  color: #6b21a8;
}

.engine-visibility button {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #7e22ce;
  color: #fff;
}
```

```js
import { createTimer, engine } from 'animejs';

const button = document.querySelector('.engine-visibility .toggle');
const value = document.querySelector('.engine-visibility .value');
const time = document.querySelector('.engine-visibility .time');

createTimer({
  duration: 5000,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

button.addEventListener('click', () => {
  engine.pauseOnDocumentHidden = !engine.pauseOnDocumentHidden;
  value.textContent = String(engine.pauseOnDocumentHidden);
  button.textContent = engine.pauseOnDocumentHidden
    ? 'Keep pausing in hidden tabs'
    : 'Allow catch-up in hidden tabs';
});
```

---

## Engine methods

These methods operate on the shared engine instead of a single timer or animation.

### update()

Docs: <https://animejs.com/documentation/engine/engine-methods/update/>

- Parameters: none
- Returns: the `engine` object
- Notes:
  - This advances the engine manually.
  - The docs pair it with `engine.useDefaultMainLoop = false`, then drive updates from a custom `requestAnimationFrame()` loop.

```html
<section class="engine-update">
  <button type="button" class="toggle">Start custom loop</button>
  <p>Status: <output class="status">idle</output></p>
  <p>Timer time: <output class="time">0</output></p>
</section>
```

```css
.engine-update {
  display: grid;
  gap: 0.45rem;
  width: 16rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #ecfeff;
  color: #155e75;
}

.engine-update button {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #0891b2;
  color: #fff;
}
```

```js
import { createTimer, engine } from 'animejs';

const button = document.querySelector('.engine-update .toggle');
const status = document.querySelector('.engine-update .status');
const time = document.querySelector('.engine-update .time');

let rafId = 0;
let running = false;

engine.useDefaultMainLoop = false;

createTimer({
  duration: 1800,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

const tick = () => {
  engine.update();
  if (running) rafId = requestAnimationFrame(tick);
};

button.addEventListener('click', () => {
  running = !running;
  status.textContent = running ? 'custom loop running' : 'idle';
  button.textContent = running ? 'Stop custom loop' : 'Start custom loop';

  if (running) {
    rafId = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(rafId);
  }
});
```

### pause()

Docs: <https://animejs.com/documentation/engine/engine-methods/pause/>

- Parameters: none
- Returns: the `engine` object
- Use it to stop all engine-managed instances together.

```html
<section class="engine-pause">
  <button type="button" class="pause">Pause engine</button>
  <p>Global time: <output class="time">0</output></p>
</section>
```

```css
.engine-pause {
  display: grid;
  gap: 0.45rem;
  width: 15rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #fee2e2;
  color: #991b1b;
}
```

```js
import { createTimer, engine } from 'animejs';

const button = document.querySelector('.engine-pause .pause');
const time = document.querySelector('.engine-pause .time');

createTimer({
  duration: 3000,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

button.addEventListener('click', () => engine.pause());
```

### resume()

Docs: <https://animejs.com/documentation/engine/engine-methods/resume/>

- Parameters: none
- Returns: the `engine` object
- Use it after `engine.pause()` when you want all paused engine work to continue.

```html
<section class="engine-resume">
  <div class="controls">
    <button type="button" class="pause">Pause</button>
    <button type="button" class="resume">Resume</button>
  </div>
  <p>Global time: <output class="time">0</output></p>
</section>
```

```css
.engine-resume {
  display: grid;
  gap: 0.5rem;
  width: 16rem;
  padding: 1rem;
  border-radius: 0.9rem;
  background: #dcfce7;
  color: #166534;
}

.engine-resume .controls {
  display: flex;
  gap: 0.5rem;
}

.engine-resume button {
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #16a34a;
  color: #fff;
}
```

```js
import { createTimer, engine } from 'animejs';

const pause = document.querySelector('.engine-resume .pause');
const resume = document.querySelector('.engine-resume .resume');
const time = document.querySelector('.engine-resume .time');

createTimer({
  duration: 2800,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

pause.addEventListener('click', () => engine.pause());
resume.addEventListener('click', () => engine.resume());
```

---

## Engine properties

Docs: <https://animejs.com/documentation/engine/engine-properties/>

These properties live directly on the shared `engine` object.

| Property | Access | Meaning |
|----------|--------|---------|
| `timeUnit` | read/write | Current global timing unit, either milliseconds or seconds |
| `currentTime` | read-only | Current engine clock value |
| `deltaTime` | read-only | Elapsed time since the previous engine step |
| `precision` | read/write | Numeric precision used when Anime.js rounds values |
| `speed` | read/write | Global playback-rate multiplier |
| `fps` | read/write | Global frame-rate cap |
| `useDefaultMainLoop` | read/write | Whether Anime.js drives itself with its built-in main loop |
| `pauseOnDocumentHidden` | read/write | Whether the engine pauses when the page becomes hidden |

### Property snapshot example

```html
<section class="engine-properties">
  <pre class="dump"></pre>
</section>
```

```css
.engine-properties {
  width: 22rem;
  padding: 1rem;
  border-radius: 1rem;
  background: #111827;
  color: #e5e7eb;
}

.engine-properties .dump {
  margin: 0;
  font: 0.85rem/1.5 monospace;
  white-space: pre-wrap;
}
```

```js
import { createTimer, engine } from 'animejs';

const dump = document.querySelector('.engine-properties .dump');

createTimer({
  duration: 1600,
  loop: true,
  onUpdate: () => {
    dump.textContent = JSON.stringify({
      timeUnit: engine.timeUnit,
      currentTime: Math.round(engine.currentTime),
      deltaTime: Number(engine.deltaTime).toFixed(3),
      precision: engine.precision,
      speed: engine.speed,
      fps: engine.fps,
      useDefaultMainLoop: engine.useDefaultMainLoop,
      pauseOnDocumentHidden: engine.pauseOnDocumentHidden
    }, null, 2);
  }
});
```

---

## Engine defaults

Docs: <https://animejs.com/documentation/engine/engine-defaults/>

`engine.defaults` is the central place for shared playback, rendering, and callback defaults. Set these before creating the animations, timers, or timelines that should inherit them.

```js
import { engine } from 'animejs';

engine.defaults.duration = 600;
engine.defaults.ease = 'out(3)';
engine.defaults.loop = 1;
```

The official page documents the supported fields and accepted value types, rather than publishing a full initial-value table on that page.

| Default field | Accepts | What it controls |
|---------------|---------|------------------|
| `playbackEase` | `String` or `Function` | Default playback easing applied at the engine level |
| `playbackRate` | `Number` | Default speed multiplier for new instances |
| `frameRate` | `Number` | Default fps cap for new instances |
| `loop` | `Boolean` or `Number` | Default loop behavior |
| `reversed` | `Boolean` | Default starting direction |
| `alternate` | `Boolean` | Default direction-flip behavior between loops |
| `autoplay` | `Boolean` | Default autoplay behavior |
| `duration` | `Number` or `Function` | Default total duration |
| `delay` | `Number` or `Function` | Default startup wait time |
| `composition` | `String` or `Function` | Default compositing mode for overlapping effects |
| `ease` | `String` or `Function` | Default value easing |
| `loopDelay` | `Number` | Default pause between iterations |
| `modifier` | `Function` | Default value post-processor |
| `onBegin` | `Function` | Default callback for playback start |
| `onUpdate` | `Function` | Default callback for update ticks |
| `onRender` | `Function` | Default callback for render passes |
| `onLoop` | `Function` | Default callback for loop completion |
| `onComplete` | `Function` | Default callback for final completion |
| `onPause` | `Function` | Default callback for pause events |

### Shared defaults example

```html
<section class="engine-defaults">
  <button type="button" class="start">Create instances</button>
  <div class="row">
    <div class="chip chip-a">A</div>
    <div class="chip chip-b">B</div>
  </div>
  <p>Timer updates: <output class="updates">0</output></p>
</section>
```

```css
.engine-defaults {
  display: grid;
  gap: 0.65rem;
  width: 18rem;
  padding: 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  color: #9a3412;
}

.engine-defaults .row {
  display: flex;
  gap: 0.75rem;
}

.engine-defaults .chip {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: #fb923c;
  color: #fff;
  font-weight: 700;
}

.engine-defaults button {
  width: fit-content;
  border: 0;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: #c2410c;
  color: #fff;
}
```

```js
import { animate, createTimer, engine } from 'animejs';

const start = document.querySelector('.engine-defaults .start');
const updates = document.querySelector('.engine-defaults .updates');

start.addEventListener('click', () => {
  engine.defaults.duration = 900;
  engine.defaults.loop = 1;
  engine.defaults.alternate = true;
  engine.defaults.ease = 'inOutSine';
  engine.defaults.onPause = self => {
    console.log(`Paused instance ${self.id}`);
  };

  let count = 0;

  createTimer({
    onUpdate: () => {
      count += 1;
      updates.textContent = String(count);
    }
  });

  animate('.engine-defaults .chip-a', { x: '10rem' });
  animate('.engine-defaults .chip-b', { x: '10rem', delay: 150 });
});
```

## When to load this file

- Load this file for engine-wide timing, frame, visibility, or shared-default questions.
- Pair it with [animation/SKILL.md](../animation/SKILL.md), [timer/SKILL.md](../timer/SKILL.md), and [timeline/SKILL.md](../timeline/SKILL.md) when the task also needs instance-level controls.
