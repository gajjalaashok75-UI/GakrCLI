import { describe, expect, test } from 'bun:test'
import type { PackageManager } from './nativeInstaller/packageManagers.js'
import { resolvePackageManagerUpdateGuidance } from './packageManagerUpdateGuidance.js'

const UPSTREAM_PACKAGE_URL = '@anthropic-ai/claude-code'
const GAKRCLI_PACKAGE_URL = '@gakr-gakr/gakrcli'

describe('resolvePackageManagerUpdateGuidance', () => {
  test.each([
    ['homebrew', 'Homebrew', 'brew upgrade claude-code'],
    ['winget', 'winget', 'winget upgrade Anthropic.ClaudeCode'],
    ['apk', 'apk', 'apk upgrade claude-code'],
  ] as const)(
    'preserves the upstream %s command only for the upstream package',
    (manager, managerName, command) => {
      expect(
        resolvePackageManagerUpdateGuidance(manager, UPSTREAM_PACKAGE_URL),
      ).toEqual({
        message: `GakrCLI is managed by ${managerName}. Use ${managerName} to update GakrCLI.`,
        managerName,
        command,
      })
    },
  )

  test.each(['homebrew', 'winget', 'apk'] as const)(
    'does not guess an upstream command for an GakrCLI %s install',
    manager => {
      const guidance = resolvePackageManagerUpdateGuidance(
        manager,
        GAKRCLI_PACKAGE_URL,
      )

      expect(guidance.command).toBeUndefined()
      expect(guidance.message).toContain('GakrCLI')
      expect(guidance.message.toLowerCase()).toContain(manager === 'homebrew' ? 'homebrew' : manager)
      expect(JSON.stringify(guidance)).not.toContain('brew upgrade claude-code')
      expect(JSON.stringify(guidance)).not.toContain('Anthropic.ClaudeCode')
      expect(JSON.stringify(guidance)).not.toContain('apk upgrade claude-code')
    },
  )

  test('does not guess a command for an unknown custom package URL', () => {
    expect(
      resolvePackageManagerUpdateGuidance('homebrew', '@example/custom-cli'),
    ).toEqual({
      message:
        'GakrCLI is managed by Homebrew. Use Homebrew to update GakrCLI.',
      managerName: 'Homebrew',
    })
  })

  test.each(['pacman', 'deb', 'rpm', 'mise', 'asdf', 'unknown'] as PackageManager[])(
    'uses safe generic guidance for %s',
    manager => {
      expect(
        resolvePackageManagerUpdateGuidance(manager, GAKRCLI_PACKAGE_URL),
      ).toEqual({
        message:
          'GakrCLI is managed by a package manager. Use your package manager to update GakrCLI.',
      })
    },
  )
})
