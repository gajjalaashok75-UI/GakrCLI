import { describe, expect, test } from 'bun:test'
import { validatePermissionRule } from './permissionValidation.js'
import { getCustomValidation } from './toolValidationConfig.js'
import { filterInvalidPermissionRules } from './validation.js'

// Regression: TOOL_VALIDATION_CONFIG.customValidation is a plain object literal
// indexed by the permission rule's tool name. validatePermissionRule gates tool
// names on an uppercase first character, which rejects lowercase prototype
// members (`constructor`, `toString`, ...). But the double-underscore members
// (`__proto__`, `__defineGetter__`, ...) slip past that gate because
// `'_'.toUpperCase() === '_'`, then the bare `customValidation[toolName]` lookup
// resolves the inherited Object.prototype member — a truthy value the caller
// invokes as a function. That threw an uncaught TypeError from
// filterInvalidPermissionRules, so a single hostile rule in a project
// .gakrcli/settings.json aborted validation and discarded the whole file rather
// than skipping just that rule.
describe('getCustomValidation — prototype-safe lookup', () => {
  const protoNames = [
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    '__proto__',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ]

  for (const name of protoNames) {
    test(`'${name}' is not treated as a configured tool`, () => {
      expect(getCustomValidation(name)).toBeUndefined()
    })
  }

  test('genuine custom-validation tools still resolve', () => {
    expect(typeof getCustomValidation('WebSearch')).toBe('function')
    expect(typeof getCustomValidation('WebFetch')).toBe('function')
    expect(getCustomValidation('Bash')).toBeUndefined()
  })
})

describe('validatePermissionRule — proto-name tool names do not crash', () => {
  // The double-underscore members pass the uppercase gate and previously reached
  // the invoke-as-function path. Each must validate without throwing.
  const underscoreProtoRules = [
    '__proto__(x)',
    '__defineGetter__(x)',
    '__defineSetter__(x)',
    '__lookupGetter__(x)',
    '__lookupSetter__(x)',
  ]

  for (const rule of underscoreProtoRules) {
    test(`'${rule}' validates without throwing`, () => {
      expect(() => validatePermissionRule(rule)).not.toThrow()
      // The rule targets no real tool, so it is inert (valid) rather than a
      // crash — the important guarantee is that validation completes.
      expect(validatePermissionRule(rule).valid).toBe(true)
    })
  }

  // Controls: the uppercase gate still rejects lowercase proto-name rules, and
  // genuine custom validation still fires for its own tools.
  test('lowercase proto-name rules are rejected by the uppercase gate', () => {
    const result = validatePermissionRule('constructor(x)')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/uppercase/i)
  })

  test('WebSearch custom validation still rejects wildcard content', () => {
    const result = validatePermissionRule('WebSearch(foo?)')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/wildcard/i)
  })

  test('ordinary rules remain valid', () => {
    expect(validatePermissionRule('Bash(npm install)').valid).toBe(true)
    expect(validatePermissionRule('Read(src/**)').valid).toBe(true)
  })
})

describe('filterInvalidPermissionRules — one bad rule does not discard the file', () => {
  // This is the blast radius the guard protects. The throw escaped the .filter()
  // callback, so for a project .gakrcli/settings.json the caller's catch
  // returned `{ settings: null, errors: [] }` -- the whole file's configuration
  // silently dropped -- and parseCommandOutputAsSettings (MDM) has no catch at
  // all. A single hostile rule in an untrusted cloned repo was enough.
  test('proto-name rules do not abort validation of the surrounding file', () => {
    const data = {
      permissions: {
        allow: ['Bash(npm install)', '__proto__(x)', 'Read(src/**)'],
        deny: ['__defineGetter__(x)', 'Write(secrets/**)'],
      },
    }

    expect(() =>
      filterInvalidPermissionRules(data, 'settings.json'),
    ).not.toThrow()

    // Every genuine rule survives; the inert proto-name rules target no real
    // tool, so they are kept rather than reported.
    expect(data.permissions.allow).toEqual([
      'Bash(npm install)',
      '__proto__(x)',
      'Read(src/**)',
    ])
    expect(data.permissions.deny).toEqual([
      '__defineGetter__(x)',
      'Write(secrets/**)',
    ])
  })

  test('a genuinely invalid rule is still skipped, not fatal', () => {
    const data = {
      permissions: {
        allow: ['__proto__(x)', 'WebSearch(foo?)', 'Bash(npm install)'],
      },
    }

    const warnings = filterInvalidPermissionRules(data, 'settings.json')

    expect(data.permissions.allow).toEqual(['__proto__(x)', 'Bash(npm install)'])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.invalidValue).toBe('WebSearch(foo?)')
  })
})
