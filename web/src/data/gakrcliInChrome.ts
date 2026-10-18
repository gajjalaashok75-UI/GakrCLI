import { SITE } from './site'

/** Shared facts for the gakrcli in chrome docs page. */
export const GAKR_IN_CHROME = {
  docsPath: '/docs/gakrcli-in-chrome/',
  /** Served from web/public — the same path the CLI's guide link opens. */
  zipPath: '/docs/gakrcli-in-chrome/gakrcli-in-chrome.zip',
  installCommand: SITE.installCommand,
  configSnippet: `{
  "chromeExtensionId": "abcdefghijklmnopabcdefghijklmnop"
}`,
  inspectCommand: 'gakrcli --chrome',
} as const
