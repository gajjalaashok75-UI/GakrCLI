import React, { useState, useEffect, useRef } from 'react';

interface SpinnerStatusProps {
  isActive: boolean;
  activityLabel?: string;
  retryInfo?: {
    attempt: number;
    retryAt: number;
    delayMs: number;
  } | null;
  customVerbs: string[];
  customTips: string[];
  tipsEnabled: boolean;
  reducedMotion: boolean;
}

const DEFAULT_VERBS = [
  'Cooking',
  'Thinking',
  'Working',
  'Noodling',
  'Synthesizing',
  'Wrangling',
  'Composing',
  'Perusing',
  'Brewing',
  'Tinkering',
  'Pondering',
  'Orchestrating',
];
const DEFAULT_TIPS = [
  'Tip: Use @file to reference specific files',
  'Tip: Use /status to inspect the current runtime',
  'Tip: Use /clear to start fresh when switching topics',
  'Tip: Press Escape to stop the current turn',
];
const SPINNER_FRAMES = ['·', '✢', '*', '✶', '✻', '✽', '✻', '✶', '*', '✢'];

export const SpinnerStatus: React.FC<SpinnerStatusProps> = ({
  isActive,
  activityLabel,
  retryInfo,
  customVerbs,
  customTips,
  tipsEnabled,
  reducedMotion,
}) => {
  const verbs = customVerbs.length > 0 ? customVerbs : DEFAULT_VERBS;
  const tips = customTips.length > 0 ? customTips : DEFAULT_TIPS;

  const [verbIndex, setVerbIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const verbIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setVerbIndex(0);
      setTipIndex(0);
      setFrameIndex(0);
      setElapsedMs(0);
      startedAtRef.current = null;
      return;
    }

    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setNowMs(Date.now());

    if (!reducedMotion) {
      frameIntervalRef.current = setInterval(() => {
        setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
      }, 120);
    }

    verbIntervalRef.current = setInterval(() => {
      setVerbIndex((prev) => (prev + 1) % verbs.length);
    }, 3000);

    tipIntervalRef.current = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 8000);

    elapsedIntervalRef.current = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setElapsedMs(startedAtRef.current ? now - startedAtRef.current : 0);
    }, 1000);

    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (verbIntervalRef.current) clearInterval(verbIntervalRef.current);
      if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [isActive, reducedMotion, verbs.length, tips.length]);

  if (!isActive) return null;

  const retrySeconds = retryInfo ? Math.max(0, Math.ceil((retryInfo.retryAt - nowMs) / 1000)) : 0;
  const label = retryInfo
    ? `Retrying API call (attempt ${retryInfo.attempt}, next in ${formatTimer(retrySeconds)})...`
    : activityLabel || `${verbs[verbIndex]}...`;

  return (
    <div className="spinner-row" style={{ gap: 8, padding: '0 16px', fontSize: '0.85em', color: 'var(--app-secondary-foreground)' }}>
      <div
        className="gakrcli-spinner-glyph"
        role="status"
        aria-label="Loading"
      >
        {reducedMotion ? '•' : SPINNER_FRAMES[frameIndex]}
      </div>
      <span className="gakrcli-spinner-label">{label}</span>
      <span className="gakrcli-spinner-timer">{formatTimer(Math.floor(elapsedMs / 1000))}</span>
      {tipsEnabled && (
        <span style={{ marginLeft: 'auto', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
          {tips[tipIndex]}
        </span>
      )}
    </div>
  );
};

function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}
