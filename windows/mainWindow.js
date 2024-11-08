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

  // Read config before deciding to show window
  const config = readConfig();

  if (!config.channelSubmitted) {
    // Only show window if channel hasn't been submitted
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.webContents.send("prompt-channel-name");
    });
  } else {
    // If channel is already submitted, initialize WebSocket without showing window
    const channelNames = getCurrentChannel();
    console.log(`Loaded Channel Names: ${channelNames.join(", ")}`);
    if (channelNames && channelNames.length > 0) {
      try {
        initializeWebSocket(channelNames);
        checkNetworkAndReconnect(channelNames);
      } catch (error) {
        console.error("Error initializing WebSocket:", error);
      }
    }
  }

  setupIpcHandlers();

  return mainWindow;
}

function setupIpcHandlers() {
  ipcMain.on("save-channel-name", (event, channelName) => {
    saveChannelName(channelName);

    const config = readConfig();
    config.channelSubmitted = true;
    writeConfig(config);

    try {
      initializeWebSocket([channelName]);
      checkNetworkAndReconnect([channelName]);
    } catch (error) {
      console.error("Error initializing WebSocket after channel save:", error);
    }

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
