import { useEffect, useState } from 'react'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const hh = pad(now.getHours())
  const mm = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.split('/').pop()?.replace('_', ' ')

  return (
    <div className="live-clock" aria-label={`local time ${hh}:${mm}:${ss}`}>
      <span className="clock-dot" aria-hidden="true" />
      <span className="clock-time" aria-hidden="true">
        <span>{hh}</span><span className="colon">:</span><span>{mm}</span><span className="colon">:</span><span className="secs">{ss}</span>
      </span>
      {tz && <span className="clock-tz">{tz}</span>}
    </div>
  )
}
