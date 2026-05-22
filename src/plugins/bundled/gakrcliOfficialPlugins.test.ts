import { afterEach, expect, test } from 'bun:test'

import {
  clearBuiltinPlugins,
  getBuiltinPluginDefinition,
} from '../builtinPlugins.js'
import {
  GAKRCLI_OFFICIAL_PLUGINS_BUILTIN_NAME,
  registerGakrcliOfficialPluginsPlugin,
} from './gakrcliOfficialPlugins.js'

afterEach(() => {
  clearBuiltinPlugins()
})

test('gakrcli official plugins registers as a default-enabled built-in plugin', () => {
  registerGakrcliOfficialPluginsPlugin()

  const plugin = getBuiltinPluginDefinition(
    GAKRCLI_OFFICIAL_PLUGINS_BUILTIN_NAME,
  )

  expect(plugin).toBeDefined()
  expect(plugin?.defaultEnabled).toBe(true)
  expect(plugin?.description).toContain('official plugin marketplace')
})
