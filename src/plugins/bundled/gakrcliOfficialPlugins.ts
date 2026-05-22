import { registerBuiltinPlugin } from '../builtinPlugins.js'

export const GAKRCLI_OFFICIAL_PLUGINS_BUILTIN_NAME =
  'gakrcli-official-plugins'

export function registerGakrcliOfficialPluginsPlugin(): void {
  registerBuiltinPlugin({
    name: GAKRCLI_OFFICIAL_PLUGINS_BUILTIN_NAME,
    description:
      'Keeps the GakrCLI official plugin marketplace available for plugin discovery and install.',
    version: '1.0.0',
    defaultEnabled: true,
  })
}
