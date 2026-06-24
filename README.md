# FM-Audio DSP Remote 3 Integration

Native custom integration for the **Unfolded Circle Remote 3** to switch **FM-Audio DSP** presets directly over Telnet.

The integration runs on the Remote 3 itself. It does **not** require the generic Requests integration, a Raspberry Pi, Home Assistant, Node-RED, or any external bridge server.

## Features

- One native Remote 3 integration: `FM-Audio DSP`
- One remote entity with four preset commands by default
- Configurable DSP IP address, Telnet port, and preset count
- Preset UI page for Remote 3 touchscreen
- Works with activity UI buttons and hard-button mappings

## Integration IDs

- Driver ID: `fmaudiodsp`
- Instance ID after setup: `fmaudiodsp.main`
- Entity ID inside the driver: `fmaudiodsp.remote`
- Configured Remote 3 entity ID: `fmaudiodsp.main.fmaudiodsp.remote`

## Commands

The Remote entity exposes simple commands:

- `PRESET_1`
- `PRESET_2`
- `PRESET_3`
- `PRESET_4`

The preset count can be increased up to 16 in setup, but the default customer UI is designed for four Whiteline Four presets.

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
dist-fmaudiodsp-node-0.1.0.tar.gz
```

Current verified release archive:

```text
SHA256  6b62b19032667f83959f60ef639402334d379b1f34f835884c44a01e428cbd9f
Size    68K
```

## Install on Remote 3

1. Open the Remote 3 web configurator.
2. Go to integrations / custom integrations.
3. Upload `dist-fmaudiodsp-node-0.1.0.tar.gz`.
4. Add/setup **FM-Audio DSP**.
5. Enter the DSP connection values:
   - DSP IP address, e.g. `192.168.178.192`
   - Telnet port, usually `23`
   - preset count, usually `4`
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

Change `PRESET_1` to `PRESET_2`, `PRESET_3`, or `PRESET_4` for the other presets.

## Remote 3 list pagination note

The Remote 3 API defaults some list endpoints to 10 entries per page. If `/api/intg/instances` appears to show only 10 integrations, request a larger page:

```text
GET /api/intg/instances?limit=100
```

This is a UI/API pagination default, not necessarily a hard integration limit.

## Development notes

The Remote 3 custom-integration sandbox starts the driver with `driver.json` located next to the launched `/app/driver.js`. For that reason the driver initializes with:

```js
driver.init(path.join(__dirname, "driver.json"), driverSetupHandler);
```

The release package bundles dependencies into a single executable CommonJS `bin/driver.js` with esbuild. This avoids runtime dependency resolution issues on the Remote 3.

## Verification performed on the reference installation

- Driver state: `ACTIVE`
- Instance state: `CONNECTED`
- Entity enabled: `true`
- Test commands: `PRESET_1`, `PRESET_2`, `PRESET_3`, `PRESET_4`
- Remote 3 command response for all four tests: `200 OK`, `Command executed`
- Driver logs: `Switched FM-Audio DSP to preset 1..4`

The driver uses conservative Telnet timings and one automatic retry for transient DSP/Telnet timeouts during fast preset changes.
