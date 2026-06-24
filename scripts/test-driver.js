const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localDriverJson = path.join(root, 'bin', 'driver.json');
fs.copyFileSync(path.join(root, 'driver.json'), localDriverJson);

const driver = require(path.join(root, 'bin', 'driver.js'));

assert.deepStrictEqual(driver.buildLoadPreset(1), [
  'c0', 'i0', 'm4', 'n4', 'v1', 'e',
  'c0', 'i1', 'm3', 'n3', 'v1', 'e',
]);
assert.deepStrictEqual(driver.buildLoadPreset(4), [
  'c0', 'i0', 'm4', 'n4', 'v4', 'e',
  'c0', 'i1', 'm3', 'n3', 'v1', 'e',
]);

setTimeout(() => {
  console.log('driver logic ok');
  process.exit(0);
}, 300);
