import * as React from 'react';
import { PRODUCT_DISPLAY_NAME } from '../constants/product.js';
import { Text } from '../ink.js';

export function InterruptedByUser(): React.ReactNode {
  return (
    <>
      <Text dimColor>Interrupted </Text>
      {false ? (
        <Text dimColor>· [internal] /issue to report a model issue</Text>
      ) : (
        <Text dimColor>· What should {PRODUCT_DISPLAY_NAME} do instead?</Text>
      )}
    </>
  );
}
