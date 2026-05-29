import { expect, test } from 'bun:test'

import { PRODUCT_DISPLAY_NAME } from '../../constants/product.js'
import { getConfig } from './supportedSettings.js'
import { DESCRIPTION, generatePrompt } from './prompt.js'

test('ConfigTool prompt uses the shared product display name', () => {
  expect(DESCRIPTION).toBe(
    `Get or set ${PRODUCT_DISPLAY_NAME} configuration settings.`,
  )

  const prompt = generatePrompt()
  expect(prompt).toContain(
    `View or change ${PRODUCT_DISPLAY_NAME} settings.`,
  )
  const staleShortName = PRODUCT_DISPLAY_NAME.replace(/CLI$/, '')
  expect(prompt).not.toContain(`View or change ${staleShortName} settings.`)
})

test('ConfigTool setting descriptions use the shared product display name', () => {
  expect(getConfig('language')?.description).toBe(
    `Preferred language for ${PRODUCT_DISPLAY_NAME} responses and voice dictation (e.g., "japanese", "spanish")`,
  )
})
