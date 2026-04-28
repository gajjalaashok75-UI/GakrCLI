---
name: animejs-text
description: Anime.js Text and splitText() reference covering settings, split parameters, HTML template rules, methods, and properties. Use when creating line, word, or character-based Anime.js text animations.
---

# Anime.js Text Docs Companion

Official page: <https://animejs.com/documentation/text/>

This file is a section-complete, paraphrased companion to the official Anime.js Text docs and the linked `splitText()` page. It covers:

- Text module imports and entry points
- `splitText()` signature, parameters, and return value
- All TextSplitter settings
- All split parameters
- HTML template rules
- TextSplitter methods
- TextSplitter properties

Use this as a practical map of the official docs, not a replacement for them.

## Imports, signature, parameters, returns

Official references:

- Text overview: <https://animejs.com/documentation/text/>
- `splitText()`: <https://animejs.com/documentation/text/splittext/>

Primary imports shown by the docs:

```js
import { text, splitText } from 'animejs';
import { splitText as splitTextOnly } from 'animejs/text';
```

Core usage:

```js
text.splitText(target, parameters);

const split = splitText(target, parameters);
```

Official parameter contract:

| Name | Accepts |
| --- | --- |
| `target` | A valid CSS selector `String` or an `HTMLElement` |
| `parameters` | Optional `Object` of TextSplitter settings |

Official return:

- `splitText()` returns `TextSplitter`
- The Text page also shows that the same helper is available via `text.splitText()`
- The `animejs/text` subpath can import `splitText()` without bringing in the whole library

## Quick start example

This starter example mixes word masking and character motion so you can see the main split collections in one place.

```html
<section class="text-hero">
  <p class="headline">
    Motion starts with readable text.<br>
    Then the details take over.
  </p>
</section>
```

```css
.text-hero {
  min-height: 200px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f4efe7, #dce7f2);
  color: #18212f;
}

.headline {
  margin: 0;
  font: 700 2rem/1.25 Georgia, serif;
  letter-spacing: 0.04em;
  text-align: center;
}
```

```js
import { createTimeline, splitText, stagger } from 'animejs';

const split = splitText('.headline', {
  words: { wrap: 'clip' },
  chars: true,
});

createTimeline({
  loop: true,
  defaults: { duration: 700, ease: 'inOut(3)' },
})
  .add(split.words, {
    y: ['110%', '0%'],
  }, stagger(90))
  .add(split.chars, {
    y: ['-40%', '0%'],
  }, stagger(16, { from: 'center' }))
  .init();
```

## Official section map

### Text page

| Section | Official link |
| --- | --- |
| Text overview | <https://animejs.com/documentation/text/> |
| `splitText()` | <https://animejs.com/documentation/text/splittext/> |

### `splitText()` page

| Section | Official link |
| --- | --- |
| `splitText()` overview | <https://animejs.com/documentation/text/splittext/> |
| Settings | <https://animejs.com/documentation/text/splittext/textsplitter-settings/> |
| Split parameters | <https://animejs.com/documentation/text/splittext/split-parameters/> |
| HTML template | <https://animejs.com/documentation/text/splittext/html-template/> |
| Methods | <https://animejs.com/documentation/text/splittext/textsplitter-methods/> |
| Properties | <https://animejs.com/documentation/text/splittext/textsplitter-properties/> |

### Settings subsections

| Setting | Official link |
| --- | --- |
| `lines` | <https://animejs.com/documentation/text/splittext/textsplitter-settings/lines/> |
| `words` | <https://animejs.com/documentation/text/splittext/textsplitter-settings/words/> |
| `chars` | <https://animejs.com/documentation/text/splittext/textsplitter-settings/chars/> |
| `debug` | <https://animejs.com/documentation/text/splittext/textsplitter-settings/debug/> |
| `includeSpaces` | <https://animejs.com/documentation/text/splittext/textsplitter-settings/includespaces/> |
| `accessible` | <https://animejs.com/documentation/text/splittext/textsplitter-settings/accessible/> |

### Split parameter subsections

| Parameter | Official link |
| --- | --- |
| `class` | <https://animejs.com/documentation/text/splittext/split-parameters/class/> |
| `wrap` | <https://animejs.com/documentation/text/splittext/split-parameters/wrap/> |
| `clone` | <https://animejs.com/documentation/text/splittext/split-parameters/clone/> |

### Method subsections

| Method | Official link |
| --- | --- |
| `addEffect()` | <https://animejs.com/documentation/text/splittext/textsplitter-methods/addeffect/> |
| `revert()` | <https://animejs.com/documentation/text/splittext/textsplitter-methods/revert/> |
| `refresh()` | <https://animejs.com/documentation/text/splittext/textsplitter-methods/refresh/> |

## Text module overview

Official page: <https://animejs.com/documentation/text/>

The Text page is intentionally small. Its job is to tell you where Anime.js text helpers live:

- On the `text` namespace imported from `'animejs'`
- As direct named imports from `'animejs'`
- As standalone imports from `'animejs/text'`

For this page, the only documented helper is `splitText()`.

## `splitText()`

Official page: <https://animejs.com/documentation/text/splittext/>

`splitText()` is the text utility that turns a text-bearing element into line, word, and character targets you can animate directly.

| Item | Details |
| --- | --- |
| Purpose | Split, wrap, or clone text parts for animation |
| Parameters | `target`, optional `parameters` object |
| Returns | `TextSplitter` |
| Import paths | `text.splitText()`, direct `splitText`, or `'animejs/text'` |

Practical behavior to remember from the linked sections:

- Line splitting is layout-aware, so Anime.js waits for font loading to settle before finalizing line wrappers.
- If you split by lines, line wrappers can be recalculated again when the element width changes.
- Word and character animations that depend on line wrappers should be registered with `split.addEffect()` so they survive those re-splits.

Fresh example:

```html
<p class="lede">Design systems move faster when text animation stays structured.</p>
```

```css
.lede {
  margin: 0;
  max-width: 28rem;
  font: 600 1.4rem/1.5 "Trebuchet MS", sans-serif;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

const { chars } = splitText('.lede', {
  chars: { wrap: 'clip' },
});

animate(chars, {
  y: ['90%', '0%'],
  opacity: [0, 1],
  ease: 'out(3)',
  duration: 650,
  delay: stagger(35),
});
```

## TextSplitter settings

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/>

These settings decide what gets split and how the splitter behaves.

| Setting | Accepts | Default | Notes |
| --- | --- | --- | --- |
| `lines` | `Boolean`, split-parameter object, or HTML template string | `false` | Produces block-like line wrappers with `data-line` metadata. |
| `words` | `Boolean`, split-parameter object, or HTML template string | `true` | Produces word wrappers; uses `Intl.Segmenter` when the browser supports it. |
| `chars` | `Boolean`, split-parameter object, or HTML template string | `false` | Produces character wrappers with line, word, and char indexes. |
| `debug` | `Boolean` | `false` | Shows debugging outlines for lines, words, and chars. |
| `includeSpaces` | `Boolean` | `false` | Makes whitespace part of the generated split output. |
| `accessible` | `Boolean` | `true` | Creates an accessibility-oriented clone that preserves the original text structure. |

### `lines`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/lines/>

`lines` enables line-aware splitting. By default, each line becomes a block-style `<span>` with a `data-line` index.

Key points from the docs:

- You can set `lines: true`, pass a split-parameter object, or pass a custom HTML template string.
- Nested markup may be duplicated across adjacent lines so each generated line remains structurally valid.
- Font loading matters here: Anime.js waits for `document.fonts.ready` before locking in line wrappers.
- If the element width changes later, line splitting runs again and replaces the current line, word, and char elements.
- Because of that replacement, line-based animations should live inside `split.addEffect()`.

Nested element behavior, paraphrased:

- If a link or emphasis tag spans more than one rendered line, Anime.js duplicates the needed ancestor markup into each generated line wrapper.

Fresh example:

```html
<p class="line-copy">Editorial rhythm works best when every line gets its own entrance.</p>
```

```css
.line-copy {
  max-width: 20rem;
  margin: 0;
  font: 700 1.5rem/1.3 Georgia, serif;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

splitText('.line-copy', {
  lines: { wrap: 'clip' },
}).addEffect(({ lines }) => animate(lines, {
  y: ['100%', '0%'],
  duration: 800,
  ease: 'out(3)',
  delay: stagger(180),
}));
```

### `words`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/words/>

`words` controls word-level splitting. The docs make two especially important points:

- It defaults to `true`
- Browsers with `Intl.Segmenter` can split word boundaries for languages that are not space-delimited

Default wrapper behavior:

- Each word becomes an inline-block `<span>`
- Word wrappers include `data-line` and `data-word`

When `lines` is also enabled:

- Word wrappers can be rebuilt during font-ready or resize-driven line recalculation
- Register their animation with `addEffect()` if you need it to persist through re-splits

Fresh example:

```html
<p class="word-copy">Readable motion usually starts at the word level.</p>
```

```css
.word-copy {
  margin: 0;
  font: 600 1.35rem/1.4 "Segoe UI", sans-serif;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

const { words } = splitText('.word-copy', {
  words: { wrap: 'clip' },
});

animate(words, {
  y: ['110%', '0%'],
  duration: 700,
  ease: 'out(3)',
  delay: stagger(85),
});
```

### `chars`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/chars/>

`chars` enables character-level splitting. By default, each character wrapper is an inline-block `<span>` that carries:

- `data-line`
- `data-word`
- `data-char`

Accepted forms match the `lines` and `words` settings:

- `true` or `false`
- A split-parameter object
- A custom HTML template string

When combined with `lines`:

- Character wrappers are replaced whenever line splitting recalculates
- Long-running character animation should also be attached with `split.addEffect()`

Fresh example:

```html
<p class="char-copy">Precision lives in the details.</p>
```

```css
.char-copy {
  margin: 0;
  font: 700 1.6rem/1.2 Georgia, serif;
  letter-spacing: 0.03em;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

const { chars } = splitText('.char-copy', {
  chars: { wrap: 'clip' },
});

animate(chars, {
  y: ['100%', '0%'],
  rotate: ['-0.1turn', '0turn'],
  duration: 650,
  ease: 'out(3)',
  delay: stagger(28),
});
```

### `debug`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/debug/>

`debug` overlays helper styles so you can see the generated structure.

The docs call out the color coding:

- Lines are outlined in green
- Words are outlined in red
- Characters are outlined in blue

Fresh example:

```html
<div class="debug-demo">
  <p class="debug-copy">See the wrappers before tuning the motion.</p>
  <button type="button" class="debug-toggle">Toggle debug</button>
</div>
```

```css
.debug-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}
```

```js
import { splitText } from 'animejs';

let split;
let enabled = false;

document.querySelector('.debug-toggle').onclick = () => {
  if (split) split.revert();
  enabled = !enabled;
  split = splitText('.debug-copy', {
    lines: true,
    words: true,
    chars: true,
    debug: enabled,
  });
};
```

### `includeSpaces`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/includespaces/>

`includeSpaces` decides whether whitespace becomes part of the split output instead of staying implicit between wrappers.

Fresh example:

```html
<div class="spaces-demo">
  <p class="spaces-copy">Spacing can be part of the choreography.</p>
  <button type="button" class="spaces-toggle">Toggle spaces</button>
</div>
```

```css
.spaces-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}
```

```js
import { splitText } from 'animejs';

let includeSpaces = false;
let split;

const rebuild = () => {
  if (split) split.revert();
  split = splitText('.spaces-copy', {
    debug: true,
    includeSpaces,
  });
};

document.querySelector('.spaces-toggle').onclick = () => {
  includeSpaces = !includeSpaces;
  rebuild();
};

rebuild();
```

### `accessible`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-settings/accessible/>

`accessible` controls whether Anime.js creates a preserved-accessibility clone of the original element structure. It defaults to `true`.

Practical meaning:

- The animated split wrappers do not have to be the only readable version of the content
- You can inspect or style the accessibility clone through `split.$target.firstChild` in patterns like the one shown by the docs

Fresh example:

```html
<div class="access-demo">
  <p class="access-copy">Accessible text can stay intact while motion layers on top.</p>
  <button type="button" class="access-toggle">Show clone</button>
</div>
```

```css
.access-demo {
  position: relative;
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}

.access-copy {
  position: relative;
}
```

```js
import { createTimeline, splitText } from 'animejs';

const split = splitText('.access-copy', { debug: true });
const accessibleClone = split.$target.firstChild;

accessibleClone.style.cssText = `
  opacity: 0;
  position: absolute;
  inset: 0;
  outline: 1px dotted currentColor;
`;

const revealClone = createTimeline()
  .add(accessibleClone, { opacity: [0, 1], duration: 300 }, 0)
  .add(split.words, { opacity: [1, 0.35], duration: 300 }, 0)
  .init();

document.querySelector('.access-toggle').onclick = () => {
  revealClone.alternate().resume();
};
```

## Split parameters

Official page: <https://animejs.com/documentation/text/splittext/split-parameters/>

These options are used inside `lines`, `words`, or `chars` when you pass an object instead of `true`.

```js
splitText(target, {
  words: {
    wrap: 'clip',
    class: 'split-word',
    clone: 'bottom',
  },
});
```

| Parameter | Accepts | Default | Summary |
| --- | --- | --- | --- |
| `class` | `String` or `null` | `null` | Adds a class to every generated wrapper in that split level. |
| `wrap` | Overflow keyword, `true`, or `null` | `null` | Adds an extra outer wrapper with the chosen `overflow` value. |
| `clone` | Direction keyword, `true`, or `null` | `null` | Creates a positioned clone layer inside each split wrapper. |

### `class`

Official page: <https://animejs.com/documentation/text/splittext/split-parameters/class/>

`class` assigns the same CSS class to every generated wrapper for that split.

Structure summary:

- Anime.js still applies its own required display styles
- Your class is added on top of that generated element

Fresh example:

```html
<p class="class-copy">Utility classes make split styling easier.</p>
```

```css
.split-accent {
  color: #114b5f;
  background: #e4f7f5;
  border-radius: 0.25rem;
  outline: 1px solid #77c9d4;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

splitText('.class-copy', {
  chars: { class: 'split-accent' },
});

animate('.split-accent', {
  y: ['0rem', '-0.7rem', '0rem'],
  delay: stagger(70),
  loop: true,
});
```

### `wrap`

Official page: <https://animejs.com/documentation/text/splittext/split-parameters/wrap/>

`wrap` adds an extra wrapper around each split item and applies the chosen CSS `overflow` value there.

Accepted values:

- `'hidden'`
- `'clip'`
- `'visible'`
- `'scroll'`
- `'auto'`
- `true`, which behaves like `'clip'`
- `null`

Fresh example:

```html
<p class="wrap-copy">Masking is easiest when each character gets its own clip box.</p>
```

```css
.wrap-copy {
  margin: 0;
  font: 700 1.4rem/1.3 Georgia, serif;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

const { chars } = splitText('.wrap-copy', {
  chars: { wrap: true },
});

animate(chars, {
  y: ['85%', '0%'],
  duration: 700,
  ease: 'out(3)',
  delay: stagger(24),
});
```

### `clone`

Official page: <https://animejs.com/documentation/text/splittext/split-parameters/clone/>

`clone` duplicates each split item inside a positioned shell so you can slide or flip between the original and the copy.

Accepted values:

- `'left'`
- `'top'`
- `'right'`
- `'bottom'`
- `'center'`
- `true`, which behaves like `'center'`
- `null`

Generated structure, paraphrased:

- A relatively positioned outer wrapper contains the original split item
- A second absolutely positioned copy is added based on the requested direction

Fresh example:

```html
<p class="clone-copy">Double-layered text makes vertical swaps simple.</p>
```

```css
.clone-copy {
  margin: 0;
  font: 700 1.5rem/1.2 Georgia, serif;
}
```

```js
import { createTimeline, splitText, stagger } from 'animejs';

const { chars } = splitText('.clone-copy', {
  chars: {
    wrap: 'clip',
    clone: 'bottom',
  },
});

createTimeline({ defaults: { duration: 700, ease: 'inOut(2)' } })
  .add(chars, { y: '-100%' }, stagger(110, { from: 'center' }))
  .init();
```

## HTML template

Official page: <https://animejs.com/documentation/text/splittext/html-template/>

Instead of `true` or a split-parameter object, `lines`, `words`, and `chars` can each receive a template string.

Rules from the docs:

- The template must contain at least one `'{value}'` placeholder
- You can also use `'{i}'` for the current split index
- Anime.js still injects necessary layout styles automatically

Accepted value:

- A `String` containing at least one `'{value}'`

Fresh example:

```html
<p class="template-copy">Template-driven text can build 3D faces per glyph.</p>
```

```css
.template-char {
  position: relative;
  transform-style: preserve-3d;
  transform-origin: 50% 50% 0.75rem;
}

.template-face {
  position: absolute;
  left: 0;
}

.template-face--front {
  position: static;
}

.template-face--bottom {
  top: 100%;
  transform-origin: 50% 0%;
  transform: rotateX(90deg);
}
```

```js
import { createTimeline, splitText, stagger } from 'animejs';

splitText('.template-copy', {
  chars: `
    <span class="template-char glyph-{i}">
      <em class="template-face template-face--front">{value}</em>
      <em class="template-face template-face--bottom">{value}</em>
    </span>
  `,
});

const step = stagger(90);

createTimeline({ defaults: { duration: 650, ease: 'linear', loop: true } })
  .add('.template-char', { rotateX: -90 }, step)
  .add('.template-face--front', { opacity: [1, 0.3] }, step)
  .add('.template-face--bottom', { opacity: [0.3, 1] }, step)
  .init();
```

## TextSplitter methods

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-methods/>

| Method | Parameters | Returns | Summary |
| --- | --- | --- | --- |
| `addEffect()` | A function that receives the split instance | Not explicitly listed on the page; examples chain it on the splitter instance | Registers animations or callbacks that should stay in sync with future re-splits. |
| `revert()` | none | `TextSplitter` | Restores the original HTML and tears down split effects. |
| `refresh()` | none | `TextSplitter` | Re-splits the content after safe manual property changes. |

### `addEffect()`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-methods/addeffect/>

`addEffect()` is the key to durable line-based text animation.

Official behavior:

- It preserves animation and callback state across future splits
- It makes `split.revert()` able to tear those effects down too
- Effects are refreshed when the initial split waits for `document.fonts.ready`
- Effects are also refreshed when line splitting is active and the target width changes

Official accepts contract, paraphrased:

- Pass a function whose first argument is the split instance
- That function may return an `Animation`, `Timeline`, `Timer`, or a cleanup function
- Cleanup runs before the next line recalculation

Fresh example:

```html
<p class="effect-copy">Hover-aware text can survive resize-driven re-splitting.</p>
```

```css
.effect-copy {
  max-width: 22rem;
  margin: 0;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

splitText('.effect-copy', { lines: true })
  .addEffect(({ lines, words }) => {
    const intro = animate(lines, {
      y: ['50%', '0%'],
      opacity: [0, 1],
      delay: stagger(160),
      duration: 700,
    });

    const listeners = words.map(word => {
      const handler = () => animate(word, { color: '#c8553d', duration: 220 });
      word.addEventListener('pointerenter', handler);
      return () => word.removeEventListener('pointerenter', handler);
    });

    return () => {
      intro.pause();
      listeners.forEach(dispose => dispose());
    };
  });
```

### `revert()`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-methods/revert/>

`revert()` restores the original HTML, removes debug styling, and also reverts animations registered through `addEffect()`.

Fresh example:

```html
<div class="revert-demo">
  <p class="revert-copy">You can split aggressively and still cleanly roll back.</p>
  <button type="button" class="revert-button">Revert</button>
</div>
```

```css
.revert-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}
```

```js
import { animate, splitText, stagger } from 'animejs';

const split = splitText('.revert-copy', {
  words: { wrap: 'clip' },
  debug: true,
});

split.addEffect(self => animate(self.words, {
  y: ['100%', '0%'],
  duration: 900,
  delay: stagger(60),
  loop: true,
  alternate: true,
}));

document.querySelector('.revert-button').onclick = () => {
  split.revert();
};
```

### `refresh()`

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-methods/refresh/>

`refresh()` tells Anime.js to split again after you update safe splitter properties manually.

The docs explicitly list these as safe to edit before calling `refresh()`:

- `$target`
- `html`
- `debug`
- `includeSpaces`
- `accessible`
- `lineTemplate`
- `wordTemplate`
- `charTemplate`

Fresh example:

```html
<div class="refresh-demo">
  <p class="refresh-copy">Live text can keep its animation targets current.</p>
  <button type="button" class="add-word">Add word</button>
  <button type="button" class="remove-word">Remove word</button>
</div>
```

```css
.refresh-demo {
  display: grid;
  gap: 0.75rem;
  justify-items: start;
}
```

```js
import { animate, splitText, stagger, utils } from 'animejs';

const pool = ['carefully', 'cleanly', 'consistently', 'responsively'];

const split = splitText('.refresh-copy', {
  lines: { wrap: 'clip' },
});

split.addEffect(self => animate(self.words, {
  y: ['0%', '65%'],
  alternate: true,
  loop: true,
  delay: stagger(120),
}));

document.querySelector('.add-word').onclick = () => {
  split.html += ` ${utils.randomPick(pool)}`;
  split.refresh();
};

document.querySelector('.remove-word').onclick = () => {
  const next = split.words.map(word => word.textContent);
  next.pop();
  split.html = next.join(' ') || 'Reset me';
  split.refresh();
};
```

## TextSplitter properties

Official page: <https://animejs.com/documentation/text/splittext/textsplitter-properties/>

These properties are available on the `TextSplitter` returned by `splitText()`.

| Property | Type | Meaning |
| --- | --- | --- |
| `$target` | `HTMLElement` | The root element being split. |
| `html` | `String` | The HTML string currently used as split input. |
| `debug` | `Boolean` | Whether debug styles are enabled. |
| `includeSpaces` | `Boolean` | Whether spaces are wrapped into the split output. |
| `accessible` | `Boolean` | Whether the accessibility clone is being created. |
| `lines` | `Array<HTMLElement>` | Current line wrappers. |
| `words` | `Array<HTMLElement>` | Current word wrappers. |
| `chars` | `Array<HTMLElement>` | Current character wrappers. |
| `lineTemplate` | `String` | Template used for line wrappers. |
| `wordTemplate` | `String` | Template used for word wrappers. |
| `charTemplate` | `String` | Template used for character wrappers. |

Fresh example:

```js
import { splitText } from 'animejs';

const split = splitText('.headline', {
  lines: true,
  chars: true,
});

console.log({
  targetTag: split.$target.tagName,
  html: split.html,
  debug: split.debug,
  includeSpaces: split.includeSpaces,
  accessible: split.accessible,
  lineCount: split.lines.length,
  wordCount: split.words.length,
  charCount: split.chars.length,
  lineTemplate: split.lineTemplate,
  wordTemplate: split.wordTemplate,
  charTemplate: split.charTemplate,
});
```

## Practical takeaways

- Use `words` first when you want readable motion with low markup overhead.
- Turn on `chars` only when the typography needs fine-grained timing or transforms.
- Use `wrap` when you need masking without hand-writing extra DOM.
- Use `clone` when you want slot-machine, ticker, or mirrored text effects.
- Use custom templates when a split item needs multiple faces or deeper internal structure.
- If `lines` is involved, assume re-splitting can happen after fonts settle or width changes.
- Put persistent line-based animation inside `addEffect()`, not only in one-off `animate()` calls.
- Use `revert()` for cleanup and `refresh()` for safe content updates.

## When to load this file

- Load this file for split text reveals, word staggers, character motion, line masks, or accessible text-animation setups.
- Pair it with [utilities/SKILL.md](../utilities/SKILL.md) for `stagger()`, random picks, and DOM helpers.
- Pair it with [timeline/SKILL.md](../timeline/SKILL.md) when text motion is only one track in a larger sequence.
- Pair it with [scope/SKILL.md](../scope/SKILL.md) when split DOM needs reliable component cleanup.
