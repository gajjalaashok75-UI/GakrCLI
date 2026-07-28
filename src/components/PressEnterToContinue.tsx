import * as React from 'react';
import { Text } from '../ink.js';

export function PressEnterToContinue(): React.ReactNode {
  return (
    <Text color="permission">
      Press <Text bold={true}>Enter</Text> to continue…
    </Text>
  );
}
