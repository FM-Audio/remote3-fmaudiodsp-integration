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
  presetCount: 4,
  timeoutMs: 5000,
  delayMs: 180,
  commandValue: 1,
  retries: 1,
  retryDelayMs: 800
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

function saveConfig(values = {}) {
  config = {
    ...DEFAULT_CONFIG,
    ...values,
    dspHost: String(values.dsp_host || values.dspHost || config.dspHost || DEFAULT_CONFIG.dspHost),
    dspPort: Number(values.dsp_port || values.dspPort || config.dspPort || DEFAULT_CONFIG.dspPort),
    presetCount: Math.max(1, Math.min(16, Number(values.preset_count || values.presetCount || config.presetCount || DEFAULT_CONFIG.presetCount)))
  };
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2), "utf8");
  console.log("Saved config", config);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSetValue(item, subitem, value, opts = {}) {
  const channel = opts.channel ?? 0;
  const index = opts.index ?? 0;
  return [`c${channel}`, `i${index}`, `m${item}`, `n${subitem}`, `v${value}`, "e"];
}

function buildLoadPreset(preset, commandValue = DEFAULT_CONFIG.commandValue) {
  return [
    ...buildSetValue(4, 4, preset),
    ...buildSetValue(3, 3, commandValue, { index: 1 })
  ];
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
      console.log(">>>", cmd);
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

async function switchPreset(preset) {
  const commands = buildLoadPreset(preset, Number(config.commandValue || 1));
  const attempts = Math.max(1, Number(config.retries || 0) + 1);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await sendTelnetCommands(commands);
      return;
    } catch (err) {
      lastError = err;
      console.error(`Preset ${preset} attempt ${attempt}/${attempts} failed:`, err);
      if (attempt < attempts) {
        await sleep(Number(config.retryDelayMs || DEFAULT_CONFIG.retryDelayMs));
      }
    }
  }

  throw lastError;
}

function supportedCommands() {
  return Array.from({ length: Number(config.presetCount) }, (_, i) => `PRESET_${i + 1}`);
}

function createUi() {
  const page = new uc.ui.UiPage("main", "Presets");
  page.add(uc.ui.createUiText("FM-Audio DSP", 0, 0, undefined, new uc.ui.Size(4, 1)));
  page.add(uc.ui.createUiText("Preset 1", 0, 1, uc.createRemoteSendCmd("PRESET_1"), new uc.ui.Size(2, 2)));
  page.add(uc.ui.createUiText("Preset 2", 2, 1, uc.createRemoteSendCmd("PRESET_2"), new uc.ui.Size(2, 2)));
  page.add(uc.ui.createUiText("Preset 3", 0, 3, uc.createRemoteSendCmd("PRESET_3"), new uc.ui.Size(2, 2)));
  page.add(uc.ui.createUiText("Preset 4", 2, 3, uc.createRemoteSendCmd("PRESET_4"), new uc.ui.Size(2, 2)));
  return [page];
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
    const preset = Number(command.replace("PRESET_", ""));
    try {
      await switchPreset(preset);
      console.log(`Switched FM-Audio DSP to preset ${preset}`);
    } catch (err) {
      console.error(`Failed to switch FM-Audio DSP to preset ${preset}:`, err);
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

module.exports = { buildLoadPreset };
