const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");
const fs = require("fs");

const {
  CHANNEL_FILE_PATH,
  SYNC_INTERVAL,
  LOG_INTERVAL,
} = require("./config/constants");

const { initializeDatabase } = require("./database/init");
const ActivityLogger = require("./services/activityLogger");
const ChannelManager = require("./services/channelManager");
const WebSocketHandler = require("./services/websocketHandler");
const DatabaseSync = require("./services/databaseSync");

// Configure logging and auto-updater
log.transports.file.level = "debug";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Initialize services
const db = initializeDatabase();
const activityLogger = new ActivityLogger(db);

// Configure app
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");

// Auto-updater events
autoUpdater.on("update_available", () => {
  log.info("Update available.");
});

autoUpdater.on("update_downloaded", () => {
  log.info("Update downloaded. Installing...");
  autoUpdater.quitAndInstall();
});

// App lifecycle events
app.whenReady().then(() => {
  if (fs.existsSync(CHANNEL_FILE_PATH)) {
    console.log("Channel is already set. Establishing WebSocket connection.");
    const channelNames = ChannelManager.getCurrentChannel();
    wsHandler = new WebSocketHandler();
    wsHandler.initialize(channelNames);
  } else {
    createWindow(); // Create window if no channel exists
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Start periodic tasks
setInterval(() => DatabaseSync.syncDatabase(), SYNC_INTERVAL);
DatabaseSync.syncDatabase(); // Initial sync

activityLogger.logStatus();
setInterval(() => activityLogger.logStatus(), LOG_INTERVAL);

let wsHandler; // Make it accessible throughout the file

function createWindow() {
  const win = new BrowserWindow({
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

  win.loadFile("index.html");

  win.once("ready-to-show", () => {
    win.show();
  });

  win.webContents.once("did-finish-load", () => {
    win.webContents.send("prompt-channel-name");
  });

  // Initialize WebSocket handler only if channel exists
  const channelNames = ChannelManager.getCurrentChannel();
  if (channelNames.length > 0) {
    console.log(
      `Loaded Channel Names: ${channelNames.join(", ")}`,
      channelNames
    );
    wsHandler = new WebSocketHandler();
    wsHandler.initialize(channelNames);
    win.show();
  }

  // Add periodic connection status check
  setInterval(() => {
    const status = wsHandler?.getConnectionStatus();
    if (status) {
      win.webContents.send("websocket-status", status);
    }
  }, 5000);

  autoUpdater.checkForUpdatesAndNotify();
}

// Update the channel name handler
ipcMain.on("save-channel-name", (event, channelName) => {
  ChannelManager.saveChannelName(channelName);
  if (!wsHandler) {
    wsHandler = new WebSocketHandler();
  }
  wsHandler.initialize([channelName]);
});

// Add a handler for manual reconnection requests
ipcMain.on("reconnect-websocket", () => {
  if (wsHandler) {
    wsHandler.connect();
  }
});

// Reset channel function
function resetChannel() {
  fs.unlink(CHANNEL_FILE_PATH, (err) => {
    if (err) {
      console.error("Error deleting channel.json:", err);
    } else {
      console.log("Channel reset successful. 'channel.json' deleted.");
      // Notify the renderer process to prompt for a new channel name
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("prompt-channel-name");
      });
    }
  });
}

// Add reset channel handler
ipcMain.on("reset-channel", () => {
  resetChannel();
});

// resetChannel()