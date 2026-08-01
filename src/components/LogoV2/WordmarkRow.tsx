import * as React from 'react'
import { Text } from '../../ink.js'
import { WORDMARK_GAKRCLI } from '../../constants/brand.js'

/**
 * Multi-line GAKRCLI wordmark.
 */
export function WordmarkRow(): React.ReactElement {
  return (
    <>
      {WORDMARK_GAKRCLI.map((row, index) => (
        <Text key={index} bold={true} color="brand">
          {row}
        </Text>
      ))}
    </>
  )
}