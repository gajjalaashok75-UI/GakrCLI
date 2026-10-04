# Attribute UI Refactoring Plan

## Status

Refactoring of the **popup panel** is complete.
Refactoring of **attr-ui.ts (inject-scripts)** is in progress.
The attr-ui module implements the **attribute panel** UI, which is also the core of element inspection.

## Current Issues

- The attribute panel logic is entirely inside the `AutoElementHighlighter` class within the `element-marker.js` file (~2800 lines), with an extreme coupling of model, view, controller, and state — making maintenance very difficult.
- Some advanced operations (element relationship navigation, attribute editing, breakpoints) are currently redundant or not properly abstracted.
- `element-marker.js` contains too many responsibilities (element selection, UI chrome, attribute panel, help system, marker management, validation, etc.), making it extremely difficult to maintain.
- The attribute panel itself contains nearly a thousand lines, tightly coupled with multiple sub-modules.

## Goals

1. Fully decouple the attribute panel from `element-marker.js`, extracting it into an independent module.
2. Follow the MVP pattern: Model manages data, View renders UI, Presenter mediates coordination.
3. Ensure full backward compatibility; the existing marker functions must remain unaffected.
4. Implement **tracking** functionality: be able to observe and log attribute changes in real time.
5. Implement a **breakpoint** mechanism: selectively interrupt execution based on attributes.
6. Add a **copy path** capability: support unique index expressions (XPath/CSS selectors/unique selectors).

## Architecture

```
attr-ui/
  ├── model.ts          # Data model & state management
  ├── view.ts           # UI rendering & event binding
  ├── presenter.ts      # Coordination layer between model & view
  ├── utils.ts          # Utility functions (path generation, formatting)
  ├── shared.ts         # Types, constants, shared state
  └── index.ts          # Entry point, external API
```

### Model (`model.ts`)

Responsible for:
- Storing element inspection state (current element, attribute list, expanded/collapsed state)
- Managing tracking configuration (tracked attributes, breakpoint conditions)
- Managing validation state (CSS/XPath validation results)
- Recording clipboard copy history
- State change event emission (for view to observe)

### View (`view.ts`)

Responsible for:
- Rendering the attribute panel DOM
- Handling all UI event bindings (click, expand/collapse, input, etc.)
- Rendering attribute value updates
- Rendering tracking status display
- Rendering breakpoint configuration UI
- Rendering validation results
- All animation effects

### Presenter (`presenter.ts`)

Responsible for:
- Coordinating model and view
- Processing attribute inspection logic
- Managing tracking lifecycle (start/stop tracking, record change logs)
- Managing breakpoint logic (condition checking, trigger interrupt)
- Managing element relationship navigation (parent/child/sibling)
- Handling path generation and copying

### Utils (`utils.ts`)

- Generate unique selectors (prefer id, then nth-child unique path)
- Generate XPath expressions
- Format attribute display values
- Handle special character encoding
- Deep clone and diff comparison

## Execution Plan

### Phase 1: Model & Shared (Estimated: 1 day)

1. Create `shared.ts` — define all types and constants
2. Create `model.ts` — implement state management
3. Create `utils.ts` — implement utility functions

### Phase 2: View (Estimated: 1.5 days)

1. Implement panel rendering
2. Implement attribute list rendering
3. Implement tracking/breakpoint UI
4. Implement validation result display

### Phase 3: Presenter (Estimated: 1.5 days)

1. Implement inspection logic
2. Implement tracking management
3. Implement breakpoint management
4. Implement relationship navigation

### Phase 4: Integration & Testing (Estimated: 1 day)

1. Integrate into `element-marker.js`
2. Remove old attribute panel code
3. Write unit tests
4. Write integration tests

## Key Technical Points

1. **Element Relationship Navigation**: Use `parentElement`, `children`, `previousElementSibling`, `nextElementSibling` for DOM traversal, with visual highlighting for the currently navigated element.
2. **Tracking Implementation**: Use `MutationObserver` to monitor attribute changes and record change logs (timestamp, attribute name, old value, new value).
3. **Breakpoint Mechanism**: Before executing marker operations, check breakpoint conditions; if conditions are met, pause execution and prompt the user.
4. **Unique Path Generation**: Prioritize short unique selectors; fall back to `nth-child` path expressions.
5. **Performance Considerations**: When tracking a large number of attributes, batch update the UI to avoid frequent reflow; lazy render the attribute list in collapsed state.

## Interface Definitions

```typescript
// Element Inspection State
interface InspectionState {
  currentElement: Element | null;
  attributes: AttrEntry[];
  expandedPaths: Set<string>;
  trackingConfig: TrackingConfig;
  breakpoints: Breakpoint[];
  clipboard: string[];
  validationResult: ValidationResult | null;
}

// Attribute Entry
interface AttrEntry {
  name: string;
  value: string;
  originalValue?: string;
  isTracked: boolean;
  hasBreakpoint: boolean;
  isEditing: boolean;
}

// Tracking Configuration
interface TrackingConfig {
  enabled: boolean;
  trackedAttrs: string[];
  log: ChangeLog[];
}

// Change Log
interface ChangeLog {
  timestamp: number;
  attrName: string;
  oldValue: string;
  newValue: string;
}

// Breakpoint
interface Breakpoint {
  id: string;
  attrName: string;
  condition: 'changed' | 'equals' | 'contains' | 'regex';
  value: string;
  enabled: boolean;
}

// Validation Result
interface ValidationResult {
  status: 'idle' | 'validating' | 'success' | 'failure';
  message: string;
  matchCount?: number;
}
```

## Migration Steps

1. Create directory structure and implement Phase 1-3 using TDD.
2. After Phase 3 completes, import the new module in `element-marker.js` and create a compatibility adapter.
3. Comment out the old attribute panel code region by region (do not delete immediately), run tests, fix issues.
4. After confirming everything works, clean up the old code.
5. Write the `attr-ui-v2` storybook for visual regression testing.

## Risks and Mitigation

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Missing edge case attribute types | Medium | High | Preserve old code as reference; add comprehensive attribute type test coverage |
| State synchronization issues with element-marker lifecycle | Medium | High | Implement event-based decoupling; use shared EventBus |
| Performance degradation from MutationObserver | Low | Medium | Batch processing + debounce; auto-disable when not in tracking mode |
| Incomplete breakpoint condition coverage | Low | Low | Keep breakpoint logic configurable; allow custom condition injection |

## Review Checklist

- [ ] All existing marker features work correctly
- [ ] Attribute inspection covers all element types
- [ ] Tracking properly records all changes
- [ ] Breakpoints trigger correctly and recover normally
- [ ] Copy path supports multiple expression types
- [ ] Element navigation (parent/child/sibling) works properly
- [ ] Performance meets expectations (no lag in the 60fps inspector)
- [ ] Code coverage >= 80%
- [ ] All old attribute panel code properly cleaned up
