import * as React from 'react';
import { FLAG_ICON } from '../../constants/figures.js';
import { Box, Text } from '../../ink.js';

/**
 * internal-only: Banner shown in the transcript that prompts users to report
 * issues via /issue. Appears when friction is detected in the conversation.
 */
export function IssueFlagBanner(): React.ReactNode {
  return (
    <Box flexDirection="row" marginTop={1} width="100%">
      <Box minWidth={2}>
        <Text color="warning">{FLAG_ICON}</Text>
      </Box>
      <Text>
        <Text dimColor>[INTERNAL-ONLY] </Text>
        <Text color="warning" bold>
          Something off with GakrCLI?
        </Text>
        <Text dimColor> /issue to report it</Text>
      </Text>
    </Box>
  );
}
