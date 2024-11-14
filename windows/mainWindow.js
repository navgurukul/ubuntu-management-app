const { BrowserWindow, ipcMain } = require("electron");
const { readConfig, writeConfig } = require("../utils/config");
const {
  getCurrentChannel,
  saveChannelName,
  resetChannel,
} = require("../utils/channel");
const config = require("../config/paths");
const fs = require("fs");

let mainWindow = null;
let websocketManager = null;

function createWindow() {
  // Lazy load the websocket manager to avoid circular dependency
  if (!websocketManager) {
    websocketManager = require("../websocket/websocket-manager");
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
    show: false,
    skipTaskbar: true,
    title: "System Service Monitor",
  });

  mainWindow.loadFile("index.html");

  const appConfig = readConfig();

  if (!appConfig.channelSubmitted) {
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.webContents.send("prompt-channel-name");
    });
  } else {
    const channelNames = getCurrentChannel();
    console.log(`Loaded Channel Names: ${channelNames.join(", ")}`);
    websocketManager.initializeWebSocket(channelNames);
    // Use the properly exported checkConnection
    websocketManager.checkConnection(channelNames);
  }

  setupIpcHandlers();

  return mainWindow;
}

function setupIpcHandlers() {
  ipcMain.on("save-channel-name", (event, channelName) => {
    saveChannelName(channelName);

    const appConfig = readConfig();
    appConfig.channelSubmitted = true;
    writeConfig(appConfig);

    websocketManager.initializeWebSocket([channelName]);
    websocketManager.checkConnection([channelName]);

    if (mainWindow) {
      mainWindow.hide();
    }
  });

  ipcMain.on("reset-channel", () => {
    resetChannel();
  });

  ipcMain.on("check-channel-file", (event) => {
    event.sender.send(
      "channel-file-status",
      fs.existsSync(config.channelFilePath)
    );
  });
}

module.exports = { createWindow };
