/**
 * Validates that all package.json dependencies are accounted for
 * in the external lists or explicitly marked as intentionally bundled.
 *
 * Run as part of the build to catch missing externals early.
 */
import { readFileSync } from 'fs'
import {
  CLI_EXTERNALS,
  SDK_EXTERNALS,
  INTENTIONALLY_BUNDLED,
  OPTIONAL_RUNTIME_EXTERNALS,
  RUNTIME_INDIRECTION_ONLY_EXTERNALS,
} from './externals.js'
import {
  validateInstallHygieneFields,
  validateOptionalPeers,
} from './externalsValidation.js'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const allDeps = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
])

function validate(bundleName: string, externals: string[]): boolean {
  const externalSet = new Set(externals)
  const intentionallyBundledSet = new Set(INTENTIONALLY_BUNDLED)
  // Third category: reached only through the `new Function` runtime import, so
  // deliberately neither external nor bundled. Marking one external would let
  // esbuild see the specifier again and hoist the package's own static imports
  // into the bundle, which is precisely what the indirection prevents.
  const indirectionOnlySet = new Set(RUNTIME_INDIRECTION_ONLY_EXTERNALS)

  const missing = [...allDeps].filter(
    d =>
      !externalSet.has(d) &&
      !intentionallyBundledSet.has(d) &&
      !indirectionOnlySet.has(d),
  )

  if (missing.length > 0) {
    console.error(`❌ ${bundleName}: Dependencies missing from externals:`)
    for (const dep of missing) {
      console.error(`   - ${dep}`)
    }
    console.error(
      `\n   Add them to scripts/externals.ts, to INTENTIONALLY_BUNDLED, or — if\n` +
        `   they are only ever loaded via importOptionalRuntimeModule — to\n` +
        `   RUNTIME_INDIRECTION_ONLY_EXTERNALS.`,
    )
    return false
  }

  const optionalSet = new Set(OPTIONAL_RUNTIME_EXTERNALS)
  const extra = [...externalSet].filter(d => !allDeps.has(d) && !optionalSet.has(d))
  if (extra.length > 0) {
    console.warn(`⚠️  ${bundleName}: External entries not in package.json (may be ok):`)
    for (const dep of extra) {
      console.warn(`   - ${dep}`)
    }
  }

  console.log(`✓ ${bundleName}: All dependencies accounted for (${missing.length} missing, ${externalSet.size} external)`)
  return true
}

function validateIntentionallyBundled(): boolean {
  const stale = INTENTIONALLY_BUNDLED.filter(dep => !allDeps.has(dep))

  if (stale.length > 0) {
    console.error(`❌ INTENTIONALLY_BUNDLED entries not in package.json:`)
    for (const dep of stale) {
      console.error(`   - ${dep}`)
    }
    console.error(
      `\n   Remove stale entries from INTENTIONALLY_BUNDLED or add the package back to dependencies.`,
    )
    return false
  }

  console.log(`✓ INTENTIONALLY_BUNDLED: All entries still exist in package.json (${INTENTIONALLY_BUNDLED.length} entries)`)
  return true
}

/**
 * Keep the indirection-only exemption honest. It suppresses the
 * dependency-coverage error above, so an unchecked entry would let a genuinely
 * un-externalized package slip through:
 *  - every entry must also be an OPTIONAL_RUNTIME_EXTERNAL (it is loaded on
 *    demand by definition), and
 *  - no entry may appear in either bundle's externals, or esbuild sees the
 *    specifier again and hoists the package's static imports into the bundle.
 */
function validateIndirectionOnly(): boolean {
  const optionalSet = new Set(OPTIONAL_RUNTIME_EXTERNALS)
  const cli = new Set(CLI_EXTERNALS)
  const sdk = new Set(SDK_EXTERNALS)
  const errors: string[] = []

  for (const dep of RUNTIME_INDIRECTION_ONLY_EXTERNALS) {
    if (!optionalSet.has(dep)) {
      errors.push(`${dep}: in RUNTIME_INDIRECTION_ONLY_EXTERNALS but not in OPTIONAL_RUNTIME_EXTERNALS.`)
    }
    const leaked = [
      ...(cli.has(dep) ? ['CLI_EXTERNALS'] : []),
      ...(sdk.has(dep) ? ['SDK_EXTERNALS'] : []),
    ]
    if (leaked.length > 0) {
      errors.push(
        `${dep}: runtime-indirection-only, so it must NOT be listed in ${leaked.join(' or ')}.`,
      )
    }
  }

  if (errors.length > 0) {
    console.error(`❌ RUNTIME_INDIRECTION_ONLY_EXTERNALS invalid:`)
    for (const e of errors) console.error(`   - ${e}`)
    return false
  }

  console.log(
    `✓ RUNTIME_INDIRECTION_ONLY_EXTERNALS: consistent (${RUNTIME_INDIRECTION_ONLY_EXTERNALS.length} entries).`,
  )
  return true
}

/**
 * Packaging hygiene for THIS repo's package.json, checked at build time.
 *
 * scripts/verify-clean-install.ts already runs validateInstallHygieneFields,
 * but against the *globally installed* artifact — so a regression is only caught
 * in that opt-in publish verifier, after the bad manifest has been built and
 * published. These two checks are the model-agnostic subset of
 * externalsValidation.ts (they say nothing about how many packages ship or
 * whether versions are exact-pinned), so they can run against the source
 * manifest on every build:
 *  - no consumer-run install hooks, no `funding` field, engines.node pinned;
 *  - every peerDependency marked optional, so adding a non-optional one (which
 *    npm 7+ tries to install for every user) fails here instead of silently
 *    regressing install output.
 *
 * The remaining validators in externalsValidation.ts stay out on purpose:
 * validateRuntimeDependencyContract, its validateIntentionallyBundled, and
 * validateOptionalRuntimeExternals all encode the reference's minimal-install
 * shipping model (3 exact-pinned runtime deps, every optional SDK a
 * devDependency). This package ships 111 caret-ranged dependencies, so those
 * three would fail by construction — adopting them is a shipping-model decision,
 * not a validation gap. They remain available to verify-clean-install.ts, which
 * checks a published artifact.
 */
function validatePackagingHygiene(): boolean {
  const checks: [string, { ok: boolean; errors: string[] }][] = [
    ['install hygiene', validateInstallHygieneFields(pkg)],
    ['optional peerDependencies', validateOptionalPeers(pkg)],
  ]

  const failures = checks.filter(([, result]) => !result.ok)
  if (failures.length > 0) {
    console.error(`❌ package.json packaging hygiene:`)
    for (const [name, result] of failures) {
      for (const error of result.errors) console.error(`   - [${name}] ${error}`)
    }
    return false
  }

  const peerCount = Object.keys(pkg.peerDependencies || {}).length
  console.log(
    `✓ package.json hygiene: no consumer install hooks, engines.node pinned, ` +
      `${peerCount} peerDependencies (all optional).`,
  )
  return true
}

const cliOk = validate('CLI bundle', CLI_EXTERNALS)
const sdkOk = validate('SDK bundle', SDK_EXTERNALS)
const intentionallyBundledOk = validateIntentionallyBundled()
const indirectionOnlyOk = validateIndirectionOnly()
const packagingHygieneOk = validatePackagingHygiene()

if (
  !cliOk ||
  !sdkOk ||
  !intentionallyBundledOk ||
  !indirectionOnlyOk ||
  !packagingHygieneOk
) {
  console.error(`\n❌ External list validation failed. Fix scripts/externals.ts before committing.`)
  process.exit(1)
}

console.log('\n✓ All external lists valid.')

// ============================================================================
// Validate sdk.d.ts ↔ index.ts export drift
// ============================================================================

const SDK_DTS_PATH = 'src/entrypoints/sdk.d.ts'
const SDK_INDEX_PATH = 'src/entrypoints/sdk/index.ts'

function extractExportNames(filePath: string): Set<string> {
  const content = readFileSync(filePath, 'utf8')
  const names = new Set<string>()
  // Match: export { name1, name2 } / export type { name1 } / export class/function/interface/const/type Name
  for (const match of content.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const name of match[1].split(',')) {
      const trimmed = name.trim().split(/\s+as\s+/)[0].trim()
      if (trimmed) names.add(trimmed)
    }
  }
  for (const match of content.matchAll(
    /export\s+(?:type\s+)?(?:class|function|interface|const|type)\s+(\w+)/g,
  )) {
    names.add(match[1])
  }
  return names
}

const dtsExports = extractExportNames(SDK_DTS_PATH)
const indexExports = extractExportNames(SDK_INDEX_PATH)

const inDtsNotIndex = [...dtsExports].filter(n => !indexExports.has(n))
const inIndexNotDts = [...indexExports].filter(n => !dtsExports.has(n))

if (inDtsNotIndex.length > 0 || inIndexNotDts.length > 0) {
  console.error(`\n❌ SDK type declaration drift detected:`)
  if (inDtsNotIndex.length > 0) {
    console.error(`   In sdk.d.ts but not in index.ts:`)
    for (const name of inDtsNotIndex) console.error(`     - ${name}`)
  }
  if (inIndexNotDts.length > 0) {
    console.error(`   In index.ts but not in sdk.d.ts:`)
    for (const name of inIndexNotDts) console.error(`     - ${name}`)
  }
  console.error(`\n   Keep sdk.d.ts in sync with src/entrypoints/sdk/index.ts.`)
  process.exit(1)
}

console.log(`✓ SDK type declarations in sync (${dtsExports.size} exports match).`)
