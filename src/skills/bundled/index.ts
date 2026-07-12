import { feature } from 'bun:bundle'
import { registerBatchSkill } from './batch.js'
import { registerCronDeleteSkill, registerCronListSkill } from './cronManage.js'
import { registerDebugSkill } from './debug.js'
import { shouldEnableGakrCLIInChromeSkill } from './gakrcliInChromeAccess.js'
import { registerKeybindingsSkill } from './keybindings.js'
import { registerLoremIpsumSkill } from './loremIpsum.js'
import { registerLoopSkill } from './loop.js'
import { registerPdfSkill } from './pdf.js'
import { registerRememberSkill } from './remember.js'
import { registerSimplifySkill } from './simplify.js'
import { registerSkillifySkill } from './skillify.js'
import { registerStuckSkill } from './stuck.js'
import { registerUltracodeSkill } from './ultracode.js'
import { registerUpdateConfigSkill } from './updateConfig.js'
import { registerUseArtifactsSkill } from './useArtifacts.js'
import { registerVerifySkill } from './verify.js'

/**
 * Initialize all bundled skills.
 * Called at startup to register skills that ship with the CLI.
 *
 * To add a new bundled skill:
 * 1. Create a new file in src/skills/bundled/ (e.g., myskill.ts)
 * 2. Export a register function that calls registerBundledSkill()
 * 3. Import and call that function here
 */
export function initBundledSkills(): void {
  registerUpdateConfigSkill()
  registerKeybindingsSkill()
  registerVerifySkill()
  registerDebugSkill()
  registerLoremIpsumSkill()
  registerSkillifySkill()
  registerRememberSkill()
  registerSimplifySkill()
  registerUseArtifactsSkill()
  registerBatchSkill()
  registerStuckSkill()
  registerUltracodeSkill()
  registerPdfSkill()
  registerLoopSkill()
  registerCronListSkill()
  registerCronDeleteSkill()
  if (feature('KAIROS') || feature('KAIROS_DREAM')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerDreamSkill } = require('./dream.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerDreamSkill()
  }
  if (feature('REVIEW_ARTIFACT')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerHunterSkill } = require('./hunter.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerHunterSkill()
  }
  // /loop's isEnabled delegates to isKairosCronEnabled() — registered
  // unconditionally so the static import is bundled; visibility is gated
  // at runtime by the isEnabled callback.
  registerLoopSkill()
  if (feature('AGENT_TRIGGERS_REMOTE')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {
      registerScheduleRemoteAgentsSkill,
    } = require('./scheduleRemoteAgents.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerScheduleRemoteAgentsSkill()
  }
  if (feature('BUILDING_GAKR_APPS')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerGakrCLIApiSkill } = require('./gakrcliApi.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerGakrCLIApiSkill()
  }
  if (shouldEnableGakrCLIInChromeSkill()) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerGakrCLIInChromeSkill } = require('./gakrcliInChrome.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerGakrCLIInChromeSkill()
  }
  if (feature('RUN_SKILL_GENERATOR')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerRunSkillGeneratorSkill } = require('./runSkillGenerator.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerRunSkillGeneratorSkill()
  }
}
