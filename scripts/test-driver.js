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
assert.deepStrictEqual(driver.buildLoadPreset(100), [
  'c0', 'i0', 'm4', 'n4', 'v100', 'e',
  'c0', 'i1', 'm3', 'n3', 'v1', 'e',
]);
assert.deepStrictEqual(driver.buildEnterPin('1234'), [
  'c0', 'i0', 'm5', 'n5', 'v1234', 'e',
]);
assert.deepStrictEqual(driver.buildStandaloneCommand('STANDBY'), [
  'c0', 'i4', 'm3', 'n3', 'v1', 'e',
]);
assert.deepStrictEqual(driver.buildStandaloneCommand('WAKE'), [
  'c0', 'i5', 'm3', 'n3', 'v1', 'e',
]);
assert.deepStrictEqual(driver.buildStandaloneCommand('LOCATE'), [
  'c0', 'i6', 'm3', 'n3', 'v1', 'e',
]);
assert.strictEqual(driver.MIN_PRESETS, 2);
assert.strictEqual(driver.MAX_PRESETS, 100);
assert.strictEqual(driver.presetCommands().length, 4);
assert.deepStrictEqual(driver.presetCommands(), ['PRESET_1', 'PRESET_2', 'PRESET_3', 'PRESET_4']);
assert.deepStrictEqual(driver.supportedCommands(), ['PRESET_1', 'PRESET_2', 'PRESET_3', 'PRESET_4', 'STANDBY', 'WAKE', 'LOCATE']);
assert.strictEqual(driver.createUi().length, 2);

setTimeout(() => {
  console.log('driver logic ok');
  process.exit(0);
}, 300);
