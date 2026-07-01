import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
}

export default function Terminal({ title = '~/your-repo', children }: Props) {
  return (
    <div className="terminal" role="img" aria-label="terminal session showing gakrcli editing code">
      <div className="terminal-bar">
        <span className="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>{title}</span>
      </div>
      <div className="terminal-body">
        {children}
      </div>
    </div>
  )
}
