import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { hello } from 'jilatax';

assert.equal(hello('world'), 'Hello, world!');

const require = createRequire(import.meta.url);
const cjs = require('jilatax');
assert.equal(cjs.hello('world'), 'Hello, world!');

console.log('smoke test passed');
