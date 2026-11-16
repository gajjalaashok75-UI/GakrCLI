import { stripVTControlCharacters } from 'node:util'
import React from 'react'
import {
  generateSeed,
  getCompanion,
  rollWithSeed,
} from '../../buddy/companion.js'
import { CompanionCard } from '../../buddy/CompanionCard.js'
import { triggerCompanionReaction } from '../../buddy/companionReact.js'
import { renderSprite } from '../../buddy/sprites.js'
import {
  corsair,
  ember,
  type Form,
  FORM_NAMES,
  FORMS,
  kage,
  kaio,
  merlin,
  parseForm,
  RARITY_STARS,
  robinhood,
  strawhat,
  type StoredCompanion,
  twig,
} from '../../buddy/types.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import { stringWidth } from '../../ink/stringWidth.js'
import type { ToolUseContext } from '../../Tool.js'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import {
  type GlobalConfig,
  getGlobalConfig,
  saveGlobalConfig,
} from '../../utils/config.js'

// Flavor for /buddy set confirmations. A full Record so adding a hero
// without flavor text is a compile error.
const FORM_FLAVOR: Record<Form, { don: string; hint: string }> = {
  [robinhood]: {
    don: 'dons the green hood',
    hint: 'Submit any message to see the arrow fly.',
  },
  [kaio]: {
    don: 'seals the helmet and powers up the visor',
    hint: 'Submit any message to fire the energy wave.',
  },
  [strawhat]: {
    don: 'wiggles all five tentacles',
    hint: 'Submit any message to throw the long-reach punch.',
  },
  [merlin]: {
    don: 'raises the star-tipped staff',
    hint: 'Submit any message to cast the sparkle stream.',
  },
  [kage]: {
    don: 'melts into the shadows',
    hint: 'Submit any message to throw the shuriken.',
  },
  [ember]: {
    don: 'puffs a proud little smoke ring',
    hint: 'Submit any message to breathe fire.',
  },
  [corsair]: {
    don: 'tips the tricorn',
    hint: 'Submit any message to fire the cannon.',
  },
  [twig]: {
    don: 'curls up its tail and grins',
    hint: 'Submit any message to lob an acorn.',
  },
}

const FORM_LIST = FORMS.map(form => FORM_NAMES[form].toLowerCase()).join(', ')

// Species → default name fragments for hatch (no API needed).
const SPECIES_NAMES: Record<string, string> = {
  duck: 'Waddles',
  goose: 'Goosberry',
  blob: 'Gooey',
  cat: 'Whiskers',
  dragon: 'Ember',
  octopus: 'Inky',
  owl: 'Hoots',
  penguin: 'Waddleford',
  turtle: 'Shelly',
  snail: 'Trailblazer',
  ghost: 'Casper',
  axolotl: 'Axie',
  capybara: 'Chill',
  cactus: 'Spike',
  robot: 'Byte',
  rabbit: 'Flops',
  mushroom: 'Spore',
  chonk: 'Chonk',
}

const SPECIES_PERSONALITY: Record<string, string> = {
  duck: 'Quirky and easily amused. Leaves rubber duck debugging tips everywhere.',
  goose: 'Assertive and honks at bad code. Takes no prisoners in code reviews.',
  blob: 'Adaptable and goes with the flow. Sometimes splits into two when confused.',
  cat: 'Independent and judgmental. Watches you type with mild disdain.',
  dragon:
    'Fiery and passionate about architecture. Hoards good variable names.',
  octopus:
    'Multitasker extraordinaire. Wraps tentacles around every problem at once.',
  owl: 'Wise but verbose. Always says "let me think about that" for exactly 3 seconds.',
  penguin: 'Cool under pressure. Slides gracefully through merge conflicts.',
  turtle: 'Patient and thorough. Believes slow and steady wins the deploy.',
  snail: 'Methodical and leaves a trail of useful comments. Never rushes.',
  ghost:
    'Ethereal and appears at the worst possible moments with spooky insights.',
  axolotl: 'Regenerative and cheerful. Recovers from any bug with a smile.',
  capybara: 'Zen master. Remains calm while everything around is on fire.',
  cactus:
    'Prickly on the outside but full of good intentions. Thrives on neglect.',
  robot: 'Efficient and literal. Processes feedback in binary.',
  rabbit: 'Energetic and hops between tasks. Finishes before you start.',
  mushroom: 'Quietly insightful. Grows on you over time.',
  chonk:
    'Big, warm, and takes up the whole couch. Prioritizes comfort over elegance.',
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formName(form: Form): string {
  return FORM_NAMES[form]
}

function setCompanionReaction(
  context: LocalJSXCommandContext,
  reaction: string | undefined,
  pet = false,
): void {
  context.setAppState(prev => ({
    ...prev,
    companionReaction: reaction,
    companionPetAt: pet ? Date.now() : prev.companionPetAt,
  }))
}

// The sprite reads the companion config non-reactively, and its clock is
// paused under reduced motion. Every config change therefore also bumps an
// AppState version the sprite subscribes to, so it redraws (or hides) at once.
function saveCompanionConfig(
  context: LocalJSXCommandContext,
  update: (current: GlobalConfig) => GlobalConfig,
): void {
  saveGlobalConfig(update)
  context.setAppState(prev => ({
    ...prev,
    companionConfigVersion: (prev.companionConfigVersion ?? 0) + 1,
  }))
}

function showHelp(onDone: LocalJSXCommandOnDone): void {
  onDone(
    `Usage: /buddy [status|off|on|mute|unmute|pet|dance|set <form|random>|name <new name>|help]\n\nForms: ${FORM_LIST}\n\nRun /buddy with no args to hatch your companion the first time, then pet it on later runs. /buddy set picks a hero form with its own Enter animation; /buddy set random restores the rolled one; /buddy dance starts a short dance; /buddy name renames your companion.`,
    { display: 'system' },
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args?: string,
): Promise<React.ReactNode> {
  const arg = args?.trim().toLowerCase() ?? ''

  if (COMMON_HELP_ARGS.includes(arg)) {
    showHelp(onDone)
    return null
  }

  if (COMMON_INFO_ARGS.includes(arg) || arg === 'status') {
    const companion = getCompanion()
    if (!companion) {
      onDone('No companion hatched yet. Run /buddy to hatch one.', {
        display: 'system',
      })
      return null
    }
    const chosenForm = getGlobalConfig().companion?.speciesOverride
      ? ' (chosen form — /buddy set random to revert)'
      : ''
    onDone(
      `${companion.name} is your ${titleCase(companion.rarity)} ${formName(companion.species)}${chosenForm}. ${companion.personality}`,
      { display: 'system' },
    )
    return null
  }

  // ── /buddy off|mute — mute companion ──
  if (arg === 'off' || arg === 'mute') {
    saveCompanionConfig(context, current => ({
      ...current,
      companionMuted: true,
    }))
    setCompanionReaction(context, undefined)
    onDone('companion muted', { display: 'system' })
    return null
  }

  // ── /buddy on|unmute — unmute companion ──
  if (arg === 'on' || arg === 'unmute') {
    saveCompanionConfig(context, current => ({
      ...current,
      companionMuted: false,
    }))
    const companion = getCompanion()
    if (companion) {
      setCompanionReaction(context, `${companion.name} is back.`)
    }
    onDone('companion unmuted', { display: 'system' })
    return null
  }

  // ── /buddy pet — trigger heart animation + auto unmute ──
  if (arg === 'pet') {
    const companion = getCompanion()
    if (!companion) {
      onDone('no companion yet \u00b7 run /buddy first', { display: 'system' })
      return null
    }

    // Auto-unmute on pet + trigger heart animation
    saveCompanionConfig(context, current => ({
      ...current,
      companionMuted: false,
    }))
    context.setAppState(prev => ({ ...prev, companionPetAt: Date.now() }))

    // Trigger a post-pet reaction
    triggerCompanionReaction(context.messages ?? [], reaction =>
      context.setAppState(prev =>
        prev.companionReaction === reaction
          ? prev
          : { ...prev, companionReaction: reaction },
      ),
    )

    onDone(`petted ${companion.name}`, { display: 'system' })
    return null
  }

  const [sub, ...rest] = arg.split(/\s+/)

  // ── /buddy dance ──
  if (sub === 'dance' && rest.length === 0) {
    const companion = getCompanion()
    if (!companion) {
      onDone('No companion hatched yet. Run /buddy to hatch one first.', {
        display: 'system',
      })
      return null
    }
    if (getGlobalConfig().companionMuted) {
      onDone(
        `${companion.name} is hidden (buddy is muted). Run /buddy unmute to show them.`,
        { display: 'system' },
      )
      return null
    }
    // The sprite's clock is frozen under reduced motion, so it skips the
    // dance; say so rather than leave the command looking broken.
    if (context.getAppState?.().settings?.prefersReducedMotion === true) {
      onDone(
        `${companion.name} sits this one out: dancing is off while reduced motion is on.`,
        { display: 'system' },
      )
      return null
    }
    context.setAppState(prev => ({ ...prev, companionDanceAt: Date.now() }))
    onDone(undefined, { display: 'skip' })
    return null
  }

  // ── /buddy name <new name> ──
  if (sub === 'name') {
    if (!getGlobalConfig().companion) {
      onDone('No companion hatched yet. Run /buddy to hatch one first.', {
        display: 'system',
      })
      return null
    }
    // Parse from the raw args (not `arg`) so capitalization is preserved.
    // Sanitize: the name renders verbatim in the sprite column, so ANSI
    // escapes / control / zero-width characters would corrupt the TUI line
    // until the next rename. Cap by DISPLAY width, not UTF-16 length.
    const newName = stripVTControlCharacters(
      (args ?? '').trim().split(/\s+/).slice(1).join(' '),
    )
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      .trim()
    if (!newName) {
      onDone('Usage: /buddy name <new name>', { display: 'system' })
      return null
    }
    if (stringWidth(newName) > 20) {
      onDone('Buddy names are capped at 20 columns.', { display: 'system' })
      return null
    }
    const previous = getCompanion()!.name
    saveCompanionConfig(context, current => ({
      ...current,
      companion: current.companion
        ? { ...current.companion, name: newName }
        : current.companion,
    }))
    if (!getGlobalConfig().companionMuted) {
      setCompanionReaction(context, `${newName} answers to their new name.`)
    }
    onDone(`${previous} is now called ${newName}.`, { display: 'system' })
    return null
  }

  // ── /buddy set <form|random> ──
  if (sub === 'set') {
    if (!getGlobalConfig().companion) {
      onDone('No companion hatched yet. Run /buddy to hatch one first.', {
        display: 'system',
      })
      return null
    }
    const target = rest[0]
    if (target === 'random') {
      saveCompanionConfig(context, current => ({
        ...current,
        companion: current.companion
          ? { ...current.companion, speciesOverride: undefined }
          : current.companion,
      }))
      const companion = getCompanion()!
      setCompanionReaction(
        context,
        `${companion.name} is back to being ${formName(companion.species)}.`,
      )
      onDone(
        `${companion.name} is back to their rolled form: ${titleCase(companion.rarity)} ${formName(companion.species)}.`,
        { display: 'system' },
      )
      return null
    }
    const form = target === undefined ? undefined : parseForm(target)
    if (form !== undefined) {
      saveCompanionConfig(context, current => ({
        ...current,
        companion: current.companion
          ? { ...current.companion, speciesOverride: form }
          : current.companion,
      }))
      const companion = getCompanion()!
      const flavor = FORM_FLAVOR[form]
      setCompanionReaction(context, `${companion.name} ${flavor.don}.`)
      const mutedHint = getGlobalConfig().companionMuted
        ? ' Note: your buddy is muted and hidden — run /buddy unmute to see them.'
        : ''
      onDone(
        `${companion.name} is now ${formName(form)}. ${flavor.hint} /buddy set random reverts.${mutedHint}`,
        { display: 'system' },
      )
      return null
    }
    onDone(
      `Unknown form '${rest[0] ?? ''}'. Available: ${FORM_LIST}, random.`,
      { display: 'system' },
    )
    return null
  }

  if (arg !== '') {
    showHelp(onDone)
    return null
  }

  // ── /buddy (no args) — show existing card or hatch ──
  const companion = getCompanion()

  // Auto-unmute when viewing
  if (companion && getGlobalConfig().companionMuted) {
    saveCompanionConfig(context, current => ({
      ...current,
      companionMuted: false,
    }))
  }

  if (companion) {
    // Return JSX card — matches official vc8 component
    const lastReaction = context.getAppState?.()?.companionReaction
    return React.createElement(CompanionCard, {
      companion,
      lastReaction,
      onDone: onDone as unknown as Parameters<
        typeof CompanionCard
      >[0]['onDone'],
    })
  }

  // ── No companion → hatch ──
  const seed = generateSeed()
  const r = rollWithSeed(seed)
  const name = SPECIES_NAMES[r.bones.species] ?? 'Buddy'
  const personality =
    SPECIES_PERSONALITY[r.bones.species] ?? 'Mysterious and code-savvy.'

  const stored: StoredCompanion = {
    name,
    personality,
    seed,
    hatchedAt: Date.now(),
  }

  saveCompanionConfig(context, current => ({
    ...current,
    companion: stored,
    companionMuted: false,
  }))

  // Greet on hatch (saveCompanionConfig already redraws).
  const hatched = getCompanion()
  if (hatched) {
    setCompanionReaction(
      context,
      `${hatched.name} the ${formName(hatched.species)} has hatched.`,
      true,
    )
  }

  const stars = RARITY_STARS[r.bones.rarity]
  const sprite = renderSprite(r.bones, 0)
  const shiny = r.bones.shiny ? ' \u2728 Shiny!' : ''

  const lines = [
    'A wild companion appeared!',
    '',
    ...sprite,
    '',
    `${name} the ${titleCase(r.bones.species)}${shiny}`,
    `Rarity: ${stars} (${r.bones.rarity})`,
    `"${personality}"`,
    '',
    'Your companion will now appear beside your input box!',
    'Say its name to get its take \u00b7 /buddy pet \u00b7 /buddy off',
  ]
  onDone(lines.join('\n'), { display: 'system' })
  return null
}
