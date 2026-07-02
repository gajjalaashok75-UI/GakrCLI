import { useCallback, useState } from 'react'

interface Props {
  command: string
  className?: string
}

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
)

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
      aria-label={copied ? 'copied to clipboard' : `copy command: ${command}`}
    >
      <span className="prefix" aria-hidden="true">$</span>
      <span className="cmd">{command}</span>
      <span className="hint-icon" aria-hidden="true">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
    </button>
  )
}
