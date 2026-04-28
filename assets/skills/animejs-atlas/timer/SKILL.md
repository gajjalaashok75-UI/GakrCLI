---
name: animejs-timer
description: Anime.js createTimer() reference covering playback settings, callbacks, methods, and timer properties. Use when scheduling synchronized callbacks, loop timing, frame updates, or timer-driven interaction flows.
---

# Timer Module

Anime.js timers schedule callback-driven time flows without relying on `setTimeout()` or `setInterval()`. This companion tracks the official Timer docs while rewriting everything in plain language and swapping in fresh examples.

## Official reference

- Main page: <https://animejs.com/documentation/timer/>
- Playback settings hub: <https://animejs.com/documentation/timer/timer-playback-settings/>
- Callbacks hub: <https://animejs.com/documentation/timer/timer-callbacks/>
- Methods hub: <https://animejs.com/documentation/timer/timer-methods/>
- Properties page: <https://animejs.com/documentation/timer/timer-properties/>

## Official section map

### Playback settings

- `delay`: <https://animejs.com/documentation/timer/timer-playback-settings/delay/>
- `duration`: <https://animejs.com/documentation/timer/timer-playback-settings/duration/>
- `loop`: <https://animejs.com/documentation/timer/timer-playback-settings/loop/>
- `loopDelay`: <https://animejs.com/documentation/timer/timer-playback-settings/playback-loopdelay/>
- `alternate`: <https://animejs.com/documentation/timer/timer-playback-settings/alternate/>
- `reversed`: <https://animejs.com/documentation/timer/timer-playback-settings/reversed/>
- `autoplay`: <https://animejs.com/documentation/timer/timer-playback-settings/autoplay/>
- `frameRate`: <https://animejs.com/documentation/timer/timer-playback-settings/framerate/>
- `playbackRate`: <https://animejs.com/documentation/timer/timer-playback-settings/playbackrate/>

### Callbacks

- `onBegin`: <https://animejs.com/documentation/timer/timer-callbacks/onbegin/>
- `onComplete`: <https://animejs.com/documentation/timer/timer-callbacks/oncomplete/>
- `onUpdate`: <https://animejs.com/documentation/timer/timer-callbacks/onupdate/>
- `onLoop`: <https://animejs.com/documentation/timer/timer-callbacks/onloop/>
- `onPause`: <https://animejs.com/documentation/timer/timer-callbacks/onpause/>
- `then()`: <https://animejs.com/documentation/timer/timer-callbacks/then/>

### Methods

- `play()`: <https://animejs.com/documentation/timer/timer-methods/play/>
- `reverse()`: <https://animejs.com/documentation/timer/timer-methods/reverse/>
- `pause()`: <https://animejs.com/documentation/timer/timer-methods/pause/>
- `restart()`: <https://animejs.com/documentation/timer/timer-methods/restart/>
- `alternate()`: <https://animejs.com/documentation/timer/timer-methods/alternate/>
- `resume()`: <https://animejs.com/documentation/timer/timer-methods/resume/>
- `complete()`: <https://animejs.com/documentation/timer/timer-methods/complete/>
- `reset()`: <https://animejs.com/documentation/timer/timer-methods/reset/>
- `cancel()`: <https://animejs.com/documentation/timer/timer-methods/cancel/>
- `revert()`: <https://animejs.com/documentation/timer/timer-methods/revert/>
- `seek()`: <https://animejs.com/documentation/timer/timer-methods/seek/>
- `stretch()`: <https://animejs.com/documentation/timer/timer-methods/stretch/>

### Properties

- `Timer properties`: <https://animejs.com/documentation/timer/timer-properties/>

---

## Imports

Import timers from the main package when you are already using other Anime.js APIs:

```js
import { createTimer } from 'animejs';
```

Or import the timer API from its dedicated subpath:

```js
import { createTimer } from 'animejs/timer';
```

## Signature

```js
const timer = createTimer(parameters);
```

### Parameters

| Name | Accepts |
|------|---------|
| `parameters` (optional) | An object containing Timer playback settings and Timer callbacks |

### Returns

`Timer`

### Fresh starter example

```html
<section class="timer-intro">
  <p>Elapsed: <output class="elapsed">0</output> ms</p>
  <p>Loops: <output class="loops">0</output></p>
</section>
```

```css
.timer-intro { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border: 1px solid #cbd5e1; border-radius: 0.85rem; background: #f8fafc; }
.timer-intro output { font: 700 1rem/1.2 monospace; color: #0f172a; }
```

```js
import { createTimer } from 'animejs';

const elapsed = document.querySelector('.timer-intro .elapsed');
const loops = document.querySelector('.timer-intro .loops');

let loopCount = 0;

createTimer({
  duration: 900,
  loop: 2,
  frameRate: 24,
  onUpdate: timer => {
    elapsed.textContent = Math.round(timer.currentTime);
  },
  onLoop: () => {
    loopCount += 1;
    loops.textContent = String(loopCount);
  }
});
```

---

## Timer playback settings

Playback settings live directly inside the `createTimer()` options object.

```js
createTimer({
  duration: 1000,
  loop: true,
  frameRate: 30,
  onUpdate: () => {}
});
```

### delay

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/delay/>

- Accepts: a number greater than or equal to `0`
- Default: `0`
- Global default: `engine.defaults.delay = 500`
- Use it to wait before the timer begins advancing.

```html
<div class="timer-delay">Starts after <output class="value">waiting</output></div>
```

```css
.timer-delay { display: inline-block; padding: 0.8rem 1rem; border-radius: 0.75rem; background: #eff6ff; color: #1e3a8a; font: 600 0.95rem/1.3 system-ui; }
.timer-delay .value { font-family: monospace; }
```

```js
import { createTimer } from 'animejs';

const value = document.querySelector('.timer-delay .value');

createTimer({
  delay: 700,
  duration: 1000,
  onUpdate: timer => {
    value.textContent = `${Math.round(timer.currentTime)} ms`;
  }
});
```

### duration

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/duration/>

- Accepts: a number greater than or equal to `0`
- Default: `Infinity`
- Note: `0` completes immediately on play
- Note: values above `1e12` are clamped internally

```html
<div class="timer-duration">Run time: <output class="value">0</output> ms</div>
```

```css
.timer-duration { display: inline-flex; gap: 0.5rem; padding: 0.8rem 1rem; border: 1px solid #d1fae5; border-radius: 0.75rem; background: #ecfdf5; color: #065f46; }
.timer-duration .value { font: 700 1rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const value = document.querySelector('.timer-duration .value');

createTimer({
  duration: 1800,
  onUpdate: timer => {
    value.textContent = String(Math.round(timer.currentTime));
  }
});
```

### loop

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/loop/>

- Accepts: `Number`, `Infinity`, `true`, or `-1`
- Default: `0`
- `true` and `-1` both mean "repeat forever"
- Global default: `engine.defaults.loop = true`

```html
<div class="timer-loop">
  <p>Completed loops: <output class="loops">0</output></p>
  <p>Iteration time: <output class="time">0</output></p>
</div>
```

```css
.timer-loop { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #fff7ed; color: #9a3412; }
.timer-loop output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const loops = document.querySelector('.timer-loop .loops');
const time = document.querySelector('.timer-loop .time');

let count = 0;

createTimer({
  duration: 600,
  loop: 3,
  onLoop: () => {
    count += 1;
    loops.textContent = String(count);
  },
  onUpdate: timer => {
    time.textContent = String(Math.round(timer.iterationCurrentTime));
  }
});
```

### loopDelay

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/playback-loopdelay/>

- Accepts: a number greater than or equal to `0`
- Default: `0`
- Global default: `engine.defaults.loopDelay = 500`
- Adds a pause between one iteration finishing and the next one starting.

```html
<div class="timer-loop-delay">
  <p>Loop hits: <output class="loops">0</output></p>
  <p>Visible time: <output class="time">0</output></p>
</div>
```

```css
.timer-loop-delay { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border: 1px solid #fde68a; border-radius: 0.8rem; background: #fffbeb; color: #92400e; }
.timer-loop-delay output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const loops = document.querySelector('.timer-loop-delay .loops');
const time = document.querySelector('.timer-loop-delay .time');

let count = 0;

createTimer({
  duration: 300,
  loop: true,
  loopDelay: 800,
  onLoop: () => {
    count += 1;
    loops.textContent = String(count);
  },
  onUpdate: timer => {
    time.textContent = String(Math.round(timer.iterationCurrentTime));
  }
});
```

### alternate

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/alternate/>

- Accepts: `Boolean`
- Default: `false`
- Global default: `engine.defaults.alternate = true`
- The direction flips each iteration when looping is enabled.

```html
<div class="timer-alt">
  <p>Loop hits: <output class="loops">0</output></p>
  <p>Iteration time: <output class="time">0</output></p>
</div>
```

```css
.timer-alt { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #f5f3ff; color: #5b21b6; }
.timer-alt output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const loops = document.querySelector('.timer-alt .loops');
const time = document.querySelector('.timer-alt .time');

let count = 0;

createTimer({
  duration: 900,
  loop: true,
  alternate: true,
  onLoop: () => {
    count += 1;
    loops.textContent = String(count);
  },
  onUpdate: timer => {
    time.textContent = String(Math.round(timer.iterationCurrentTime));
  }
});
```

### reversed

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/reversed/>

- Accepts: `Boolean`
- Default: `false`
- Global default: `engine.defaults.reversed = true`
- This changes the starting direction; the overall `currentTime` still runs from `0` toward `duration`.

```html
<div class="timer-reversed">
  <p>Iteration: <output class="iteration">0</output></p>
  <p>Total: <output class="total">0</output></p>
</div>
```

```css
.timer-reversed { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border: 1px solid #fecaca; border-radius: 0.8rem; background: #fef2f2; color: #991b1b; }
.timer-reversed output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const iteration = document.querySelector('.timer-reversed .iteration');
const total = document.querySelector('.timer-reversed .total');

createTimer({
  duration: 2400,
  reversed: true,
  onUpdate: timer => {
    iteration.textContent = String(Math.round(timer.iterationCurrentTime));
    total.textContent = String(Math.round(timer.currentTime));
  }
});
```

### autoplay

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/autoplay/>

- Accepts: `Boolean` or `onScroll()`
- Default: `true`
- Global default: `engine.defaults.autoplay = false`
- Note: when a timer is inserted into a timeline, Anime.js forces `autoplay` to `false`
- Related API: <https://animejs.com/documentation/events/onscroll/>

```html
<div class="timer-autoplay">
  <output class="time">0</output>
  <button type="button" class="play">Start</button>
</div>
```

```css
.timer-autoplay { display: inline-flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #eef2ff; color: #3730a3; }
.timer-autoplay button { border: 0; border-radius: 999px; padding: 0.45rem 0.85rem; background: #4338ca; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const time = document.querySelector('.timer-autoplay .time');
const play = document.querySelector('.timer-autoplay .play');

const timer = createTimer({
  autoplay: false,
  duration: 1600,
  onUpdate: self => {
    time.textContent = `${Math.round(self.currentTime)} ms`;
  }
});

play.addEventListener('click', () => timer.play());
```

### frameRate

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/framerate/>

- Accepts: a number greater than `0`
- Default: `120`
- Global default: `engine.defaults.frameRate = 30`
- Note: the browser or the display refresh rate can still cap the effective fps
- Runtime control: `timer.fps = 30`

```html
<div class="timer-fps">
  <label>FPS <input class="range" type="range" min="1" max="120" value="30" /></label>
  <p>Chosen fps: <output class="fps">30</output></p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-fps { display: grid; gap: 0.4rem; width: 16rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #f0fdf4; color: #166534; }
.timer-fps output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const slider = document.querySelector('.timer-fps .range');
const fps = document.querySelector('.timer-fps .fps');
const time = document.querySelector('.timer-fps .time');

const timer = createTimer({
  frameRate: 30,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

slider.addEventListener('input', () => {
  timer.fps = Number(slider.value);
  fps.textContent = slider.value;
});
```

### playbackRate

Docs: <https://animejs.com/documentation/timer/timer-playback-settings/playbackrate/>

- Accepts: a number greater than or equal to `0`
- Default: `1`
- Global default: `engine.defaults.playbackRate = 0.75`
- Note: `0` prevents playback from advancing
- Runtime control: `timer.speed = 0.5`

```html
<div class="timer-speed">
  <label>Speed <input class="range" type="range" min="0" max="3" step="0.1" value="1.5" /></label>
  <p>Speed: <output class="speed">1.5</output>x</p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-speed { display: grid; gap: 0.4rem; width: 16rem; padding: 0.9rem 1rem; border: 1px solid #bfdbfe; border-radius: 0.8rem; background: #eff6ff; color: #1d4ed8; }
.timer-speed output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const slider = document.querySelector('.timer-speed .range');
const speed = document.querySelector('.timer-speed .speed');
const time = document.querySelector('.timer-speed .time');

const timer = createTimer({
  playbackRate: 1.5,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

slider.addEventListener('input', () => {
  timer.speed = Number(slider.value);
  speed.textContent = slider.value;
});
```

---

## Timer callbacks

Callbacks also live in the `createTimer()` options object.

```js
createTimer({
  duration: 1000,
  onBegin: () => {},
  onLoop: () => {},
  onUpdate: () => {}
});
```

### onBegin

Docs: <https://animejs.com/documentation/timer/timer-callbacks/onbegin/>

- Accepts: a function whose first argument is the timer
- Default: `noop`
- Global default: `engine.defaults.onBegin = self => console.log(self.id)`
- Fires when playback actually starts.

```html
<div class="timer-on-begin">
  <p>Began: <output class="began">false</output></p>
  <p>Mirror timer: <output class="time">0</output></p>
</div>
```

```css
.timer-on-begin { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #fefce8; color: #854d0e; }
.timer-on-begin output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const began = document.querySelector('.timer-on-begin .began');
const time = document.querySelector('.timer-on-begin .time');

const tracked = createTimer({
  delay: 500,
  duration: 1200,
  onBegin: () => {
    began.textContent = 'true';
  }
});

createTimer({
  duration: 2200,
  onUpdate: () => {
    time.textContent = String(Math.round(tracked.currentTime));
  }
});
```

### onComplete

Docs: <https://animejs.com/documentation/timer/timer-callbacks/oncomplete/>

- Accepts: a function whose first argument is the timer
- Default: `noop`
- Global default: `engine.defaults.onComplete = self => console.log(self.id)`
- Runs after the timer finishes all configured iterations.

```html
<div class="timer-on-complete">
  <p>Completed: <output class="done">false</output></p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-on-complete { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border: 1px solid #ddd6fe; border-radius: 0.8rem; background: #f5f3ff; color: #6d28d9; }
.timer-on-complete output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const done = document.querySelector('.timer-on-complete .done');
const time = document.querySelector('.timer-on-complete .time');

createTimer({
  duration: 1400,
  onComplete: () => {
    done.textContent = 'true';
  },
  onUpdate: timer => {
    time.textContent = String(Math.round(timer.currentTime));
  }
});
```

### onUpdate

Docs: <https://animejs.com/documentation/timer/timer-callbacks/onupdate/>

- Accepts: a function whose first argument is the timer
- Default: `noop`
- Global default: `engine.defaults.onUpdate = self => console.log(self.id)`
- Fires on each rendered step at the active `frameRate`.

```html
<div class="timer-on-update">
  <p>Updates: <output class="updates">0</output></p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-on-update { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #ecfeff; color: #155e75; }
.timer-on-update output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const updates = document.querySelector('.timer-on-update .updates');
const time = document.querySelector('.timer-on-update .time');

let count = 0;

createTimer({
  onUpdate: timer => {
    count += 1;
    updates.textContent = String(count);
    time.textContent = String(Math.round(timer.currentTime));
  }
});
```

### onLoop

Docs: <https://animejs.com/documentation/timer/timer-callbacks/onloop/>

- Accepts: a function whose first argument is the timer
- Default: `noop`
- Global default: `engine.defaults.onLoop = self => console.log(self.id)`
- Runs once per completed iteration.

```html
<div class="timer-on-loop">
  <p>Loop callbacks: <output class="loops">0</output></p>
  <p>Iteration: <output class="time">0</output></p>
</div>
```

```css
.timer-on-loop { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #fff1f2; color: #be123c; }
.timer-on-loop output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const loops = document.querySelector('.timer-on-loop .loops');
const time = document.querySelector('.timer-on-loop .time');

let count = 0;

createTimer({
  duration: 700,
  loop: 2,
  onLoop: () => {
    count += 1;
    loops.textContent = String(count);
  },
  onUpdate: timer => {
    time.textContent = String(Math.round(timer.iterationCurrentTime));
  }
});
```

### onPause

Docs: <https://animejs.com/documentation/timer/timer-callbacks/onpause/>

- Accepts: a function whose first argument is the timer
- Default: `noop`
- Global default: `engine.defaults.onPause = self => console.log(self.id)`
- Fires only when a running timer enters the paused state.

```html
<div class="timer-on-pause">
  <button type="button" class="resume">Resume</button>
  <button type="button" class="pause">Pause</button>
  <p>Pause hits: <output class="count">0</output></p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-on-pause { display: grid; gap: 0.45rem; width: 15rem; padding: 0.9rem 1rem; border: 1px solid #e5e7eb; border-radius: 0.8rem; background: #ffffff; color: #111827; }
.timer-on-pause button { border: 0; border-radius: 999px; padding: 0.4rem 0.75rem; background: #111827; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const resume = document.querySelector('.timer-on-pause .resume');
const pause = document.querySelector('.timer-on-pause .pause');
const count = document.querySelector('.timer-on-pause .count');
const time = document.querySelector('.timer-on-pause .time');

let pauses = 0;

const timer = createTimer({
  duration: 2200,
  loop: true,
  onPause: () => {
    pauses += 1;
    count.textContent = String(pauses);
  },
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

resume.addEventListener('click', () => timer.resume());
pause.addEventListener('click', () => timer.pause());
```

### then()

Docs: <https://animejs.com/documentation/timer/timer-callbacks/then/>

- Parameters: `callback`, a function whose first argument is the timer
- Returns: `Promise`
- Use it inline or in `async`/`await` flows once the timer finishes.

Inline chaining:

```js
createTimer({ duration: 400 }).then(timer => {
  console.log(timer.completed);
});
```

`async`/`await` flow:

```js
async function waitForTimer() {
  return createTimer({ duration: 400 });
}

const finishedTimer = await waitForTimer();
console.log(finishedTimer.currentTime);
```

```html
<div class="timer-then">
  <p>Status: <output class="status">pending</output></p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-then { display: grid; gap: 0.35rem; width: 14rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #faf5ff; color: #7e22ce; }
.timer-then output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const status = document.querySelector('.timer-then .status');
const time = document.querySelector('.timer-then .time');

createTimer({
  duration: 1300,
  onUpdate: timer => {
    time.textContent = String(Math.round(timer.currentTime));
  }
}).then(() => {
  status.textContent = 'fulfilled';
});
```

---

## Timer methods

Methods are available on the `Timer` instance returned by `createTimer()`.

```js
const timer = createTimer({ duration: 1000, autoplay: false });

timer.play();
timer.pause();
timer.restart();
```

### play()

Docs: <https://animejs.com/documentation/timer/timer-methods/play/>

- Returns: the timer instance
- Behavior: starts playback and forces the forward direction

```html
<div class="timer-play">
  <button type="button" class="play">Play forward</button>
  <output class="time">0</output>
</div>
```

```css
.timer-play { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #ecfccb; color: #365314; }
.timer-play button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #65a30d; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-play .play');
const time = document.querySelector('.timer-play .time');

const timer = createTimer({
  autoplay: false,
  duration: 1800,
  onUpdate: self => {
    time.textContent = String(Math.round(self.iterationCurrentTime));
  }
});

button.addEventListener('click', () => timer.play());
```

### reverse()

Docs: <https://animejs.com/documentation/timer/timer-methods/reverse/>

- Returns: the timer instance
- Behavior: forces backward playback

```html
<div class="timer-reverse">
  <button type="button" class="reverse">Reverse</button>
  <output class="time">0</output>
</div>
```

```css
.timer-reverse { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #fef3c7; color: #92400e; }
.timer-reverse button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #d97706; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-reverse .reverse');
const time = document.querySelector('.timer-reverse .time');

const timer = createTimer({
  duration: 1800,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.iterationCurrentTime));
  }
});

button.addEventListener('click', () => timer.reverse());
```

### pause()

Docs: <https://animejs.com/documentation/timer/timer-methods/pause/>

- Returns: the timer instance
- Behavior: pauses the current run

```html
<div class="timer-pause">
  <button type="button" class="pause">Pause</button>
  <output class="time">0</output>
</div>
```

```css
.timer-pause { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #fee2e2; color: #991b1b; }
.timer-pause button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #dc2626; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-pause .pause');
const time = document.querySelector('.timer-pause .time');

const timer = createTimer({
  duration: 2500,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

button.addEventListener('click', () => timer.pause());
```

### restart()

Docs: <https://animejs.com/documentation/timer/timer-methods/restart/>

- Returns: the timer instance
- Behavior: resets the timer to `0`; if `autoplay` is `true`, playback begins again immediately

```html
<div class="timer-restart">
  <button type="button" class="restart">Restart</button>
  <output class="time">0</output>
</div>
```

```css
.timer-restart { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #e0f2fe; color: #0c4a6e; }
.timer-restart button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #0284c7; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-restart .restart');
const time = document.querySelector('.timer-restart .time');

const timer = createTimer({
  duration: 1600,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

button.addEventListener('click', () => timer.restart());
```

### alternate()

Docs: <https://animejs.com/documentation/timer/timer-methods/alternate/>

- Returns: the timer instance
- Behavior: flips the direction and keeps the current progress aligned
- Note: the per-iteration clock is what visually reverses

```html
<div class="timer-method-alternate">
  <button type="button" class="alternate">Alternate</button>
  <output class="time">0</output>
</div>
```

```css
.timer-method-alternate { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #ede9fe; color: #5b21b6; }
.timer-method-alternate button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #7c3aed; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-method-alternate .alternate');
const time = document.querySelector('.timer-method-alternate .time');

const timer = createTimer({
  duration: 2200,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.iterationCurrentTime));
  }
});

button.addEventListener('click', () => timer.alternate());
```

### resume()

Docs: <https://animejs.com/documentation/timer/timer-methods/resume/>

- Returns: the timer instance
- Behavior: continues a paused timer in its current direction

```html
<div class="timer-resume">
  <button type="button" class="resume">Resume</button>
  <button type="button" class="pause">Pause</button>
  <button type="button" class="alternate">Flip</button>
  <p>Iteration: <output class="time">0</output></p>
</div>
```

```css
.timer-resume { display: grid; gap: 0.45rem; width: 15rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #f1f5f9; color: #0f172a; }
.timer-resume button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #0f172a; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const resume = document.querySelector('.timer-resume .resume');
const pause = document.querySelector('.timer-resume .pause');
const alternate = document.querySelector('.timer-resume .alternate');
const time = document.querySelector('.timer-resume .time');

const timer = createTimer({
  duration: 1800,
  loop: true,
  onUpdate: self => {
    time.textContent = String(Math.round(self.iterationCurrentTime));
  }
});

resume.addEventListener('click', () => timer.resume());
pause.addEventListener('click', () => timer.pause());
alternate.addEventListener('click', () => timer.alternate());
```

### complete()

Docs: <https://animejs.com/documentation/timer/timer-methods/complete/>

- Returns: the timer instance
- Behavior: jumps to the finished state immediately

```html
<div class="timer-complete">
  <button type="button" class="complete">Complete now</button>
  <output class="time">0</output>
</div>
```

```css
.timer-complete { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #dcfce7; color: #166534; }
.timer-complete button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #16a34a; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-complete .complete');
const time = document.querySelector('.timer-complete .time');

const timer = createTimer({
  duration: 9000,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

button.addEventListener('click', () => timer.complete());
```

### reset()

Docs: <https://animejs.com/documentation/timer/timer-methods/reset/>

- Parameters: `softReset = false`
- `softReset` accepts: `Boolean`
- Returns: the timer instance
- Behavior: pauses the timer and restores `currentTime`, `progress`, `reversed`, `began`, and `completed` to their initial values
- `softReset: true` skips the visual render pass

```html
<div class="timer-reset">
  <button type="button" class="reset">Reset</button>
  <output class="time">0</output>
</div>
```

```css
.timer-reset { display: inline-flex; gap: 0.75rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #fff7ed; color: #9a3412; }
.timer-reset button { border: 0; border-radius: 999px; padding: 0.4rem 0.8rem; background: #ea580c; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const button = document.querySelector('.timer-reset .reset');
const time = document.querySelector('.timer-reset .time');

const timer = createTimer({
  duration: 2200,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

button.addEventListener('click', () => {
  timer.reset();
  time.textContent = String(Math.round(timer.currentTime));
});
```

### cancel()

Docs: <https://animejs.com/documentation/timer/timer-methods/cancel/>

- Returns: the timer instance
- Behavior: pauses the timer, removes it from the engine loop, and frees it for cleanup

```html
<div class="timer-cancel">
  <button type="button" class="play">Play</button>
  <button type="button" class="cancel">Cancel</button>
  <output class="time">0</output>
</div>
```

```css
.timer-cancel { display: inline-flex; gap: 0.65rem; align-items: center; padding: 0.85rem 1rem; border-radius: 0.8rem; background: #faf5ff; color: #6b21a8; }
.timer-cancel button { border: 0; border-radius: 999px; padding: 0.4rem 0.75rem; background: #7e22ce; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const play = document.querySelector('.timer-cancel .play');
const cancel = document.querySelector('.timer-cancel .cancel');
const time = document.querySelector('.timer-cancel .time');

const timer = createTimer({
  autoplay: false,
  duration: 4000,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

play.addEventListener('click', () => timer.play());
cancel.addEventListener('click', () => timer.cancel());
```

### revert()

Docs: <https://animejs.com/documentation/timer/timer-methods/revert/>

- Returns: the timer instance
- Behavior: cancels the timer and also tears down a linked `onScroll()` observer when present
- Use it when you want to fully stop and dispose of the timer setup

```html
<div class="timer-revert">
  <button type="button" class="play">Play</button>
  <button type="button" class="revert">Revert</button>
  <output class="time">0</output>
</div>
```

```css
.timer-revert { display: inline-flex; gap: 0.65rem; align-items: center; padding: 0.85rem 1rem; border: 1px solid #e5e7eb; border-radius: 0.8rem; background: #ffffff; color: #111827; }
.timer-revert button { border: 0; border-radius: 999px; padding: 0.4rem 0.75rem; background: #111827; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const play = document.querySelector('.timer-revert .play');
const revert = document.querySelector('.timer-revert .revert');
const time = document.querySelector('.timer-revert .time');

const timer = createTimer({
  autoplay: false,
  duration: 4000,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

play.addEventListener('click', () => timer.play());
revert.addEventListener('click', () => {
  timer.revert();
  time.textContent = 'reverted';
});
```

### seek()

Docs: <https://animejs.com/documentation/timer/timer-methods/seek/>

- Parameters:
  - `time`: `Number`
  - `muteCallbacks = false`: `Boolean`
- Returns: the timer instance
- Behavior: jumps the timer to a specific `currentTime`

```html
<div class="timer-seek">
  <input class="range" type="range" min="0" max="2000" value="0" />
  <button type="button" class="toggle">Play</button>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-seek { display: grid; gap: 0.45rem; width: 16rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #ecfeff; color: #164e63; }
.timer-seek button { width: fit-content; border: 0; border-radius: 999px; padding: 0.4rem 0.75rem; background: #0891b2; color: #fff; }
```

```js
import { createTimer } from 'animejs';

const range = document.querySelector('.timer-seek .range');
const toggle = document.querySelector('.timer-seek .toggle');
const time = document.querySelector('.timer-seek .time');

const syncLabel = timer => {
  toggle.textContent = timer.paused ? 'Play' : 'Pause';
};

const timer = createTimer({
  autoplay: false,
  duration: 2000,
  onUpdate: self => {
    range.value = String(Math.round(self.currentTime));
    time.textContent = String(Math.round(self.currentTime));
    syncLabel(self);
  },
  onComplete: syncLabel
});

range.addEventListener('input', () => {
  timer.seek(Number(range.value));
});

toggle.addEventListener('click', () => {
  if (timer.paused) {
    timer.play();
  } else {
    timer.pause();
    syncLabel(timer);
  }
});
```

### stretch()

Docs: <https://animejs.com/documentation/timer/timer-methods/stretch/>

- Parameters: `duration`, a `Number`
- Returns: the timer instance
- Behavior: retargets the timer so its total duration fits the provided time
- Practical note: total duration includes all iterations, not just one pass

```html
<div class="timer-stretch">
  <input class="range" type="range" min="1000" max="5000" step="250" value="2000" />
  <p>Total duration: <output class="duration">2000</output> ms</p>
  <p>Time: <output class="time">0</output></p>
</div>
```

```css
.timer-stretch { display: grid; gap: 0.45rem; width: 16rem; padding: 0.9rem 1rem; border-radius: 0.8rem; background: #f0fdf4; color: #166534; }
.timer-stretch output { font: 700 0.95rem/1 monospace; }
```

```js
import { createTimer } from 'animejs';

const range = document.querySelector('.timer-stretch .range');
const duration = document.querySelector('.timer-stretch .duration');
const time = document.querySelector('.timer-stretch .time');

const timer = createTimer({
  duration: 2000,
  onUpdate: self => {
    time.textContent = String(Math.round(self.currentTime));
  }
});

range.addEventListener('input', () => {
  timer.stretch(Number(range.value));
  duration.textContent = String(Math.round(timer.duration));
  timer.restart();
});
```

---

## Timer properties

Docs: <https://animejs.com/documentation/timer/timer-properties/>

These properties live on the `Timer` instance returned by `createTimer()`.

| Property | Access | Meaning |
|----------|--------|---------|
| `id` | read/write | Identifier for the timer |
| `deltaTime` | read-only | Milliseconds elapsed since the previous frame |
| `currentTime` | read/write | Global timer time in milliseconds |
| `iterationCurrentTime` | read/write | Current iteration time in milliseconds |
| `progress` | read/write | Overall progress from `0` to `1` |
| `iterationProgress` | read/write | Current iteration progress from `0` to `1` |
| `currentIteration` | read/write | Current iteration index/count |
| `speed` | read/write | Runtime playback-rate multiplier |
| `fps` | read/write | Runtime frame-rate value |
| `paused` | read/write | Whether the timer is paused |
| `began` | read/write | Whether playback has begun |
| `completed` | read/write | Whether all playback has finished |
| `reversed` | read/write | Whether the timer is marked as reversed |
| `backwards` | read-only | Whether it is currently moving backward |

### Property snapshot example

```js
import { createTimer } from 'animejs';

const timer = createTimer({ duration: 1500, autoplay: false });

console.log(timer.id);
console.log(timer.currentTime);
console.log(timer.iterationCurrentTime);
console.log(timer.progress);
console.log(timer.speed);
console.log(timer.fps);
console.log(timer.backwards);
```
