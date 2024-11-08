const { BrowserWindow, ipcMain } = require("electron");
const { readConfig, writeConfig } = require("../utils/config");
const {
  getCurrentChannel,
  saveChannelName,
  resetChannel,
} = require("../utils/channel");
const { initializeWebSocket } = require("../websocket/client");
const { checkNetworkAndReconnect } = require("../utils/network");
const fs = require("fs");
const { channelFilePath } = require("../config/paths");

let mainWindow = null;

function createWindow() {
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
  });

  mainWindow.loadFile("index.html");
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.webContents.send("prompt-channel-name");
  });

  setupIpcHandlers();

  return mainWindow;
}

function setupIpcHandlers() {
  ipcMain.on("save-channel-name", (event, channelName) => {
    saveChannelName(channelName);

    const config = readConfig();
    config.channelSubmitted = true;
    writeConfig(config);

    initializeWebSocket([channelName]);
    checkNetworkAndReconnect([channelName]);

    if (mainWindow) {
      mainWindow.hide();
    }
  });

  ipcMain.on("reset-channel", () => {
    resetChannel();
  });

  ipcMain.on("check-channel-file", (event) => {
    const exists = fs.existsSync(channelFilePath);
    event.sender.send("channel-file-status", exists);
  });
}

module.exports = { createWindow };
