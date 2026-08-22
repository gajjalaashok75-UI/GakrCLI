import * as React from 'react';
import { Text } from '../../ink.js';
import { useAppState } from '../../state/AppState.js';

/** Longest host we render before eliding — keeps the pill from crowding the footer. */
const MAX_HOST_LENGTH = 20;

type Props = {
  selected: boolean;
  showHint: boolean;
};

/**
 * Condenses the live page URL into a footer-sized label. Opaque URLs
 * (about:blank, data:, file:) have no hostname, and a half-written URL can
 * reach us mid-navigation, so both fall back to a bare "browser" rather than
 * rendering an empty pill.
 */
export function formatBagelLabel(url: string | undefined): string {
  if (!url) return 'browser';
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'browser';
  }
  if (host.length === 0) return 'browser';
  const shortHost = host.length > MAX_HOST_LENGTH ? `${host.slice(0, MAX_HOST_LENGTH - 1)}…` : host;
  return `browser (${shortHost})`;
}

/**
 * Footer pill for the WebBrowser tool, showing the live page's host.
 *
 * Text-only by design: pills in the footer's `parts` array render inside a
 * <Text wrap="truncate"> wrapper, and the Ink reconciler throws on a Box
 * nested in a Text — so this pill has no click target (unlike the tasks pill,
 * which renders as a Box sibling for exactly that reason).
 */
export function BagelPill({ selected, showHint }: Props): React.ReactNode {
  const bagelUrl = useAppState(s => s.bagelUrl);
  // Matches WebBrowserPanelGate's default so the hint's verb reflects what
  // Enter will actually do on first press.
  const panelVisible = useAppState(s => s.bagelPanelVisible ?? true);

  const hint =
    showHint && selected ? (
      <>
        <Text dimColor>· </Text>
        <Text dimColor>Enter to {panelVisible ? 'hide' : 'show'} panel</Text>
      </>
    ) : null;

  return (
    <>
      <Text key={selected ? 'selected' : 'normal'} color="background" inverse={selected}>
        {formatBagelLabel(bagelUrl)}
      </Text>
      {hint ? <Text> {hint}</Text> : null}
    </>
  );
}
