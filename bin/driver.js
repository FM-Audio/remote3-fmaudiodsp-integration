const uc = require("@unfoldedcircle/integration-api");
const fs = require("fs");
const net = require("net");
const path = require("path");

const driver = new uc.IntegrationAPI();

const ENTITY_ID = "fmaudiodsp.remote";
const ENTITY_NAME = { en: "FM-Audio DSP", de: "FM-Audio DSP" };
const DEFAULT_CONFIG = {
  dspHost: "192.168.178.192",
  dspPort: 23,
  dspPin: "",
  presetCount: 4,
  timeoutMs: 5000,
  delayMs: 180,
  commandValue: 1,
  retries: 1,
  retryDelayMs: 800
};

const MIN_PRESETS = 2;
const MAX_PRESETS = 100;
const EXTRA_COMMANDS = ["STANDBY", "WAKE", "LOCATE"];
const DSP_COMMAND_INDEX = 1;
const DSP_COMMAND_VALUE = 1;
const DSP_COMMANDS = {
  LOAD_PRESET: 1,
  STANDBY: 4,
  WAKE: 5,
  LOCATE: 6
};

function configPath() {
  return path.join(process.env.UC_CONFIG_HOME || __dirname, "config.json");
}

function loadConfig() {
  try {
    const p = configPath();
    if (fs.existsSync(p)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(p, "utf8")) };
    }
  } catch (err) {
    console.warn("Could not load config:", err);
  }
  return { ...DEFAULT_CONFIG };
}

let config = loadConfig();

function normalizePin(value) {
  return String(value || "").trim();
}

function saveConfig(values = {}) {
  const requestedPresetCount = Number(values.preset_count || values.presetCount || config.presetCount || DEFAULT_CONFIG.presetCount);
  config = {
    ...DEFAULT_CONFIG,
    ...values,
    dspHost: String(values.dsp_host || values.dspHost || config.dspHost || DEFAULT_CONFIG.dspHost),
    dspPort: Number(values.dsp_port || values.dspPort || config.dspPort || DEFAULT_CONFIG.dspPort),
    dspPin: normalizePin(values.dsp_pin || values.dspPin || config.dspPin || DEFAULT_CONFIG.dspPin),
    presetCount: Math.max(MIN_PRESETS, Math.min(MAX_PRESETS, Number.isFinite(requestedPresetCount) ? requestedPresetCount : DEFAULT_CONFIG.presetCount))
  };
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
  console.log("Saved config", { ...config, dspPin: config.dspPin ? "***" : "" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSetValue(item, subitem, value, opts = {}) {
  const channel = opts.channel ?? 0;
  const index = opts.index ?? 0;
  return [`c${channel}`, `i${index}`, `m${item}`, `n${subitem}`, `v${value}`, "e"];
}

function buildEnterPin(pin) {
  const normalized = normalizePin(pin);
  return normalized ? buildSetValue(5, 5, normalized) : [];
}

function buildDspCommand(commandNumber) {
  return buildSetValue(3, 3, DSP_COMMAND_VALUE, { index: commandNumber });
}

function withOptionalPin(commands, pin = config.dspPin) {
  return [...buildEnterPin(pin), ...commands];
}

function buildLoadPreset(preset, commandValue = DSP_COMMAND_VALUE) {
  return [
    ...buildSetValue(4, 4, preset),
    ...buildSetValue(3, 3, commandValue, { index: DSP_COMMANDS.LOAD_PRESET })
  ];
}

function buildStandaloneCommand(command) {
  const commandNumber = DSP_COMMANDS[command];
  if (!commandNumber) throw new Error(`Unsupported DSP command: ${command}`);
  return buildDspCommand(commandNumber);
}

function readQuiet(socket, quietMs = 120, maxMs = 800) {
  return new Promise((resolve) => {
    const chunks = [];
    let done = false;
    let quietTimer;
    const maxTimer = setTimeout(finish, maxMs);

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(maxTimer);
      clearTimeout(quietTimer);
      socket.off("data", onData);
      resolve(Buffer.concat(chunks).toString("utf8"));
    }
    function bumpQuiet() {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    }
    function onData(data) {
      chunks.push(data);
      bumpQuiet();
    }
    socket.on("data", onData);
    bumpQuiet();
  });
}

async function sendTelnetCommands(commands) {
  const socket = new net.Socket();
  socket.setTimeout(config.timeoutMs);
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.once("timeout", () => reject(new Error("DSP Telnet timeout")));
    socket.connect(config.dspPort, config.dspHost, resolve);
  });

  try {
    const banner = await readQuiet(socket);
    if (banner.trim()) console.log("DSP banner:", JSON.stringify(banner));

    for (const cmd of commands) {
      console.log(">>>", cmd.startsWith("v") && config.dspPin && cmd === `v${config.dspPin}` ? "v***" : cmd);
      socket.write(`${cmd}\r\n`, "ascii");
      await sleep(config.delayMs);
      const response = await readQuiet(socket, Math.max(100, config.delayMs), Math.max(250, config.delayMs * 2));
      if (response.trim()) console.log("<<<", JSON.stringify(response));
    }
  } finally {
    socket.end();
    socket.destroy();
  }
}

async function runDspCommands(commands, label) {
  const attempts = Math.max(1, Number(config.retries || 0) + 1);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sendTelnetCommands(withOptionalPin(commands));
      return;
    } catch (err) {
      lastError = err;
      console.error(`${label} attempt ${attempt}/${attempts} failed:`, err);
      if (attempt < attempts) {
        await sleep(Number(config.retryDelayMs || DEFAULT_CONFIG.retryDelayMs));
      }
    }
  }

  throw lastError;
}

async function switchPreset(preset) {
  await runDspCommands(buildLoadPreset(preset, Number(config.commandValue || DSP_COMMAND_VALUE)), `Preset ${preset}`);
}

async function runExtraCommand(command) {
  await runDspCommands(buildStandaloneCommand(command), command);
}

function presetCommands() {
  return Array.from({ length: Number(config.presetCount) }, (_, i) => `PRESET_${i + 1}`);
}

function supportedCommands() {
  return [...presetCommands(), ...EXTRA_COMMANDS];
}

function createUi() {
  const pages = [];
  const presetCount = Number(config.presetCount || DEFAULT_CONFIG.presetCount);
  const presetsPerPage = 8;

  for (let pageIndex = 0; pageIndex < Math.ceil(presetCount / presetsPerPage); pageIndex += 1) {
    const startPreset = pageIndex * presetsPerPage + 1;
    const endPreset = Math.min(startPreset + presetsPerPage - 1, presetCount);
    const page = new uc.ui.UiPage(`presets_${pageIndex + 1}`, `Presets ${startPreset}-${endPreset}`);
    page.add(uc.ui.createUiText(`FM-Audio DSP ${startPreset}-${endPreset}`, 0, 0, undefined, new uc.ui.Size(4, 1)));

    for (let preset = startPreset; preset <= endPreset; preset += 1) {
      const localIndex = preset - startPreset;
      const x = (localIndex % 2) * 2;
      const y = 1 + Math.floor(localIndex / 2);
      page.add(uc.ui.createUiText(`Preset ${preset}`, x, y, uc.createRemoteSendCmd(`PRESET_${preset}`), new uc.ui.Size(2, 1)));
    }

    pages.push(page);
  }

  const toolsPage = new uc.ui.UiPage("tools", "DSP Tools");
  toolsPage.add(uc.ui.createUiText("FM-Audio DSP Tools", 0, 0, undefined, new uc.ui.Size(4, 1)));
  toolsPage.add(uc.ui.createUiText("Standby", 0, 1, uc.createRemoteSendCmd("STANDBY"), new uc.ui.Size(2, 1)));
  toolsPage.add(uc.ui.createUiText("Wake", 2, 1, uc.createRemoteSendCmd("WAKE"), new uc.ui.Size(2, 1)));
  toolsPage.add(uc.ui.createUiText("Locate", 0, 2, uc.createRemoteSendCmd("LOCATE"), new uc.ui.Size(2, 1)));
  pages.push(toolsPage);

  return pages;
}

const cmdHandler = async function (entity, cmdId, params = {}) {
  console.log(`Got ${entity.id} command request: ${cmdId}`, params);
  if (cmdId !== uc.RemoteCommands.SendCmd && cmdId !== uc.RemoteCommands.SendCmdSequence) {
    return uc.StatusCodes.BadRequest;
  }

  const commands = cmdId === uc.RemoteCommands.SendCmdSequence ? (params.sequence || []) : [params.command || ""];
  for (const command of commands) {
    if (!supportedCommands().includes(command)) {
      console.error("Unknown command:", command);
      return uc.StatusCodes.BadRequest;
    }
    try {
      if (command.startsWith("PRESET_")) {
        const preset = Number(command.replace("PRESET_", ""));
        await switchPreset(preset);
        console.log(`Switched FM-Audio DSP to preset ${preset}`);
      } else {
        await runExtraCommand(command);
        console.log(`Executed FM-Audio DSP command ${command}`);
      }
    } catch (err) {
      console.error(`Failed to execute FM-Audio DSP command ${command}:`, err);
      return uc.StatusCodes.ServiceUnavailable;
    }
  }
  return uc.StatusCodes.Ok;
};

function addEntity() {
  const entity = new uc.Remote(ENTITY_ID, ENTITY_NAME, {
    attributes: { [uc.RemoteAttributes.State]: uc.RemoteStates.On },
    simpleCommands: supportedCommands(),
    uiPages: createUi(),
    cmdHandler
  });
  driver.addAvailableEntity(entity);
  console.log("Registered entity", ENTITY_ID, supportedCommands());
}

const driverSetupHandler = async function (msg) {
  if (msg instanceof uc.DriverSetupRequest) {
    saveConfig(msg.setupData || {});
    driver.clearAvailableEntities();
    addEntity();
    return new uc.SetupComplete();
  }
  if (msg instanceof uc.UserDataResponse) {
    saveConfig(msg.inputValues || {});
    driver.clearAvailableEntities();
    addEntity();
    return new uc.SetupComplete();
  }
  return new uc.SetupError();
};

driver.on(uc.Events.Connect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Connected);
});

driver.on(uc.Events.Disconnect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Disconnected);
});

addEntity();
driver.init(path.join(__dirname, "driver.json"), driverSetupHandler);

module.exports = {
  DSP_COMMANDS,
  buildDspCommand,
  buildEnterPin,
  buildLoadPreset,
  buildStandaloneCommand,
  createUi,
  presetCommands,
  supportedCommands,
  MIN_PRESETS,
  MAX_PRESETS
};
