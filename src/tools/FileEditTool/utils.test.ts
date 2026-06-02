import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { findActualString, normalizeFileEditInput } from './utils'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe('findActualString', () => {
  test('matches multiline blocks when only leading indentation differs', () => {
    const fileContent = [
      '<!-- qrcode library (loaded before module script) -->',
      '<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>',
      '',
      '<!-- import map for animejs ESM -->',
      '<script type="importmap">',
      '{',
      '  "imports": {',
      '    "animejs": "https://esm.sh/animejs"',
      '  }',
      '}',
      '</script>',
    ].join('\n')

    const searchString = [
      '<!-- qrcode library (loaded before module script) -->',
      ' <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>',
      '',
      ' <!-- import map for animejs ESM -->',
      ' <script type="importmap">',
      ' {',
      '   "imports": {',
      '     "animejs": "https://esm.sh/animejs"',
      '   }',
      ' }',
      ' </script>',
    ].join('\n')

    expect(findActualString(fileContent, searchString)).toBe(fileContent)
  })

  test('does not guess when a leading-whitespace-flexible match is ambiguous', () => {
    const fileContent = [
      '  <script type="importmap">',
      '  </script>',
      '<script type="importmap">',
      '</script>',
    ].join('\n')

    const searchString = [
      ' <script type="importmap">',
      ' </script>',
    ].join('\n')

    expect(findActualString(fileContent, searchString)).toBeNull()
  })

  test('normalizes anchored deletion edits when only the deleted block is still unique', () => {
    const deletedBlock = [
      '/* ═══════════════════════════════════════',
      '   Card pop animation (success feedback)',
      '   ═══════════════════════════════════════ */',
      'function animatePopCard() {',
      '  anime({',
      "    targets: '#single-card',",
      '    scale: [1, 1.02, 1],',
      '    duration: 200,',
      "    easing: 'easeOutQuad',",
      '  });',
      '}',
      '',
    ].join('\n')
    const anchor = [
      '/* ═══════════════════════════════════════',
      '   Card shake animation (error/empty feedback)',
      '   ═══════════════════════════════════════ */',
      'function animateShake() {',
    ].join('\n')
    const fileContent = [
      anchor,
      '  anime({ targets: "#single-card" });',
      '}',
      '',
      deletedBlock,
    ].join('\n')
    const filePath = writeTempFile(fileContent)

    const normalized = normalizeFileEditInput({
      file_path: filePath,
      edits: [{
        old_string: `${deletedBlock}${anchor}`,
        new_string: anchor,
        replace_all: false,
      }],
    })

    expect(normalized.edits[0]).toEqual({
      old_string: deletedBlock,
      new_string: '',
      replace_all: false,
    })
  })

  test('does not normalize anchored deletion edits when the deleted block is ambiguous', () => {
    const deletedBlock = [
      'function duplicateBlock() {',
      '  return 1',
      '}',
      '',
    ].join('\n')
    const anchor = 'function keepMe() {'
    const filePath = writeTempFile(`${deletedBlock}${anchor}\n}\n${deletedBlock}`)

    const normalized = normalizeFileEditInput({
      file_path: filePath,
      edits: [{
        old_string: `${deletedBlock}${anchor}`,
        new_string: anchor,
        replace_all: false,
      }],
    })

    expect(normalized.edits[0]).toEqual({
      old_string: `${deletedBlock}${anchor}`,
      new_string: anchor,
      replace_all: false,
    })
  })
})

function writeTempFile(content: string): string {
  const dir = mkdtempSync(join(process.cwd(), '.tmp-edit-tool-'))
  tempDirs.push(dir)
  const filePath = join(dir, 'sample.js')
  writeFileSync(filePath, content, 'utf8')
  return filePath
}
