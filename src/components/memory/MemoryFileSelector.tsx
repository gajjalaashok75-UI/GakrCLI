import { c as _c } from 'react-compiler-runtime'
import type { ComponentProps } from 'react'

interface MemoryFileSelectorProps {
  onSelect?: (file: string) => void
  testID?: string
}

export function MemoryFileSelector(t0: MemoryFileSelectorProps): React.ReactElement {
  const $ = _c(2)
  const { onSelect } = t0
  let t1
  if ($[0] !== onSelect) {
    t1 = <></>
    $[0] = onSelect
    $[1] = t1
  } else {
    t1 = $[1]
  }
  return t1 as React.ReactElement
}

export type { MemoryFileSelectorProps }
