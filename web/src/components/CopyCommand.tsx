import { useCallback, useState } from 'react'

interface Props {
  command: string
  className?: string
}

export default function CopyCommand({ command, className = '' }: Props) {
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch { /* clipboard unavailable */ }
  }, [command])

  return (
    <button
      type="button"
      className={`copy-cmd ${className}${copied ? ' copied' : ''}`}
      onClick={handleClick}
      aria-label={`copy command: ${command}`}
    >
      <span className="prefix" aria-hidden="true">$</span>
      <span className="cmd">{command}</span>
      <span className="hint" aria-hidden="true">{copied ? '✓ copied' : 'copy'}</span>
    </button>
  )
}
