import { afterAll, describe, expect, test } from 'bun:test'
import { stripVTControlCharacters as stripAnsi } from 'node:util'
import chalk from 'chalk'
import * as React from 'react'

import { WORDMARK_GAKRCLI } from '../../constants/brand.js'
import {
  renderToAnsiString,
  renderToString,
} from '../../utils/staticRender.js'
import { WordmarkRow } from './WordmarkRow.js'

// Force truecolor output during tests.
const originalChalkLevel = chalk.level
chalk.level = 3

afterAll(() => {
  chalk.level = originalChalkLevel
})

const FG_COLOR_ESCAPE = /\x1b\[38;2;\d+;\d+;\d+m/g

describe('WordmarkRow', () => {
  test('renders every row of the wordmark', async () => {
    const out = await renderToString(<WordmarkRow />, 120)

    const plain = stripAnsi(out)
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)

    expect(plain).toEqual([...WORDMARK_GAKRCLI])
  })

  test('renders the expected number of rows', async () => {
    const out = await renderToString(<WordmarkRow />, 120)

    const plain = stripAnsi(out)
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)

    expect(plain.length).toBe(WORDMARK_GAKRCLI.length)
  })

  test('applies color styling to the rendered logo', async () => {
    const out = await renderToAnsiString(<WordmarkRow />, 120)

    expect(out.match(FG_COLOR_ESCAPE)).not.toBeNull()
  })

  test('contains every logo row exactly once', async () => {
    const out = await renderToString(<WordmarkRow />, 120)
    const plain = stripAnsi(out)

    for (const row of WORDMARK_GAKRCLI) {
      expect(plain).toContain(row)
    }
  })
})