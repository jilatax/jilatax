import assert from 'node:assert/strict';

import { applySvgColor } from '@jilatax/svg';

const replaceAllDescriptor = Object.getOwnPropertyDescriptor(
  String.prototype,
  'replaceAll',
);

try {
  Object.defineProperty(String.prototype, 'replaceAll', {
    configurable: true,
    value: undefined,
    writable: true,
  });
  assert.equal(
    applySvgColor(
      '<svg fill="currentColor" stroke="currentColor"/>',
      '#22C55E',
    ),
    '<svg fill="#22C55E" stroke="#22C55E"/>',
  );
} finally {
  if (replaceAllDescriptor === undefined) {
    delete String.prototype.replaceAll;
  } else {
    Object.defineProperty(
      String.prototype,
      'replaceAll',
      replaceAllDescriptor,
    );
  }
}

console.log('runtime compatibility test passed');
