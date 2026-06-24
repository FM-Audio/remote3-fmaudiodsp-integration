# FM-Audio DSP Remote 3 Integration

Native custom integration for the **Unfolded Circle Remote 3** to control **FM-Audio DSP / AllDSP** devices directly over Telnet.

The integration runs on the Remote 3 itself. It does **not** require the generic Requests integration, a Raspberry Pi, Home Assistant, Node-RED, or any external bridge server.

## Features

- One native Remote 3 integration: `FM-Audio DSP`
- One remote entity with four preset commands by default
- Configurable preset command count from **2 to 100**
- Dynamic preset command pattern: `PRESET_N`
- Automatic preset UI pages for Remote 3 touchscreen
  - 8 preset buttons per page
  - 100 presets create 13 preset pages
- Optional DSP PIN setup for PIN-protected units
- Safe additional Telnet commands from the AllDSP Telnet instructions:
  - `STANDBY`
  - `WAKE`
  - `LOCATE`
- Works with activity UI buttons and hard-button mappings

## Integration IDs

- Driver ID: `fmaudiodsp`
- Instance ID after setup: `fmaudiodsp.main`
- Entity ID inside the driver: `fmaudiodsp.remote`
- Configured Remote 3 entity ID: `fmaudiodsp.main.fmaudiodsp.remote`

## Commands

By default, the Remote entity exposes these preset commands:

- `PRESET_1`
- `PRESET_2`
- `PRESET_3`
- `PRESET_4`

During setup, the preset count can be set from **2 to 100**. If set to 100, the entity exposes:

```text
PRESET_1 ... PRESET_100
```

The entity also exposes these utility commands:

- `STANDBY` — AllDSP command 4, go to standby
- `WAKE` — AllDSP command 5, exit standby
- `LOCATE` — AllDSP command 6, locate/wink

Gain and mute are documented by AllDSP, but are intentionally not added to this release. Preset recall, standby, wake, locate, and optional PIN entry are deterministic one-shot actions; gain/mute need a dedicated UX/state model to avoid unintended customer-side audio changes.

## DSP Telnet protocol

For preset `N`, the driver opens a TCP/Telnet connection to the configured DSP and sends these CRLF-terminated lines:

```text
c0
i0
m4
n4
vN
e
c0
i1
m3
n3
v1
e
```

This follows the AllDSP Telnet instructions:

- Select Preset: item `4`, sub-item `4`, value `N`
- Command: item `3`, sub-item `3`
- Load preset: command index `1`, value `1`

For PIN-protected units, the optional setup value `DSP PIN code` is sent first:

```text
c0
i0
m5
n5
v<PIN>
e
```

Utility commands use item `3`, sub-item `3`, value `1` with these indexes:

- `i4` = standby
- `i5` = wake / exit standby
- `i6` = locate / wink

A short delay is inserted between commands so the DSP can process the sequence reliably.

## Build

Requirements on the build machine:

- Node.js 20+
- npm
- `tar`

Build the Remote 3 package:

```bash
npm install
npm test
npm run build
```

The build creates:

```text
dist-fmaudiodsp-node-0.2.0.tar.gz
```

Current verified release archive:

```text
SHA256  e89b30012591b62add8fa0590921591f64908d975a369d0ea669b55430367a02
Size    72K
```

## Install on Remote 3

1. Open the Remote 3 web configurator.
2. Go to integrations / custom integrations.
3. Upload `dist-fmaudiodsp-node-0.2.0.tar.gz`.
4. Add/setup **FM-Audio DSP**.
5. Enter the DSP connection values:
   - DSP IP address, e.g. `192.168.178.192`
   - Telnet port, usually `23`
   - preset count, usually `4`; supported range: `2` to `100`
   - optional DSP PIN code, only if the unit is PIN-protected
6. Add/configure the available entity `FM-Audio DSP`.

## Use in an activity

Use the configured entity:

```text
fmaudiodsp.main.fmaudiodsp.remote
```

Button/action command:

```json
{
  "entity_id": "fmaudiodsp.main.fmaudiodsp.remote",
  "cmd_id": "remote.send_cmd",
  "params": {
    "command": "PRESET_1"
  }
}
```

Change `PRESET_1` to any configured preset command, for example `PRESET_2`, `PRESET_50`, or `PRESET_100` if that preset count is enabled in setup.

## Remote 3 list pagination and custom-integration limit

Two separate things are easy to confuse:

1. Some Remote 3 API list endpoints default to 10 entries per page. If `/api/intg/instances` appears to show only 10 integration instances, request a larger page:

```text
GET /api/intg/instances?limit=100
```

2. Remote 3 custom integration installation has a hard limit of 10 **custom integration drivers**. Built-in/local integrations and activities are a different category. This project consumes exactly one custom-integration slot: `fmaudiodsp`.

For a customer installation that already has 10 custom drivers, one unused custom driver must be removed or functionality must be consolidated. The customer does not need the generic Requests integration for FM-Audio DSP preset switching; this package is the single required FM-Audio DSP integration.

## Development notes

The Remote 3 custom-integration sandbox starts the driver with `driver.json` located next to the launched `/app/driver.js`. For that reason the driver initializes with:

```js
driver.init(path.join(__dirname, "driver.json"), driverSetupHandler);
```

The release package bundles dependencies into a single executable CommonJS `bin/driver.js` with esbuild. This avoids runtime dependency resolution issues on the Remote 3.

## Verification performed on the reference installation

- Driver version: `0.2.0`
- Driver state: enabled / active
- Instance state: `CONNECTED`
- Live reference instance preset count: `4` because Nils wants only four preset commands on his own Remote 3
- Entity enabled: `true`
- Exposed simple commands on the reference instance: `PRESET_1`, `PRESET_2`, `PRESET_3`, `PRESET_4`, `STANDBY`, `WAKE`, `LOCATE`
- Activity **FM-Audio Presets** contains one page **Presets + Tools** with `PRESET_1` to `PRESET_4`, `STANDBY`, `WAKE`, and `LOCATE`
- Driver package has also been locally verified with `presetCount: 100`: 100 preset commands and 13 preset pages are generated

The driver uses conservative Telnet timings and one automatic retry for transient DSP/Telnet timeouts during fast preset changes.
