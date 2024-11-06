// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const os = require("os");
const { initializeDatabase } = require("./database/database");
const {
  ensureUserDataFiles,
  readConfig,
  writeConfig,
} = require("./utils/fileUtils");
const {
  getCurrentChannel,
  saveChannelName,
  resetChannel,
} = require("./handlers/channelHandler");
const {
  initializeWebSocket,
  checkNetworkAndReconnect,
  closeConnection,
} = require("./services/websocketService");
const { startTracking } = require("./services/updaterService");
const { isOnline } = require("./utils/networkUtils");

let mainWindow;
let reconnectInterval;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  mainWindow.loadFile("index.html");

  // Hide menu bar in production
  if (app.isPackaged) {
    mainWindow.setMenuBarVisibility(false);
  }

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
    }
    closeConnection();
  });
}

async function initializeApp() {
  try {
    // Ensure all required files exist
    ensureUserDataFiles();

    // Initialize database
    await initializeDatabase();

    // Get current channel
    const channelNames = getCurrentChannel();

    // Initialize WebSocket connection if channel exists
    if (channelNames && channelNames.length > 0) {
      const wsConnection = initializeWebSocket(channelNames);

      // Start WebSocket reconnection check
      reconnectInterval = setInterval(() => {
        checkNetworkAndReconnect(channelNames);
      }, 30000);
    }

    // Start system usage tracking
    const username = os.userInfo().username;
    startTracking(username);
  } catch (error) {
    console.error("Error initializing application:", error);
    if (mainWindow) {
      mainWindow.webContents.send("initialization-error", error.message);
    }
  }
}

// IPC handlers for renderer process communication
ipcMain.handle("get-channel", async () => {
  return getCurrentChannel();
});

ipcMain.handle("save-channel", async (event, channelName) => {
  try {
    saveChannelName(channelName);
    const config = readConfig();
    config.channelSubmitted = true;
    writeConfig(config);

    // Reinitialize WebSocket connection with new channel
    const channelNames = getCurrentChannel();
    if (channelNames && channelNames.length > 0) {
      closeConnection();
      initializeWebSocket(channelNames);
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving channel:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("reset-channel", async () => {
  try {
    closeConnection();
    return resetChannel();
  } catch (error) {
    console.error("Error resetting channel:", error);
    return false;
  }
});

ipcMain.handle("check-network", async () => {
  return await isOnline();
});

ipcMain.handle("get-username", () => {
  return os.userInfo().username;
});

// App lifecycle handlers
app.whenReady().then(async () => {
  await createWindow();
  await initializeApp();

  // Handle macOS app activation
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }
  closeConnection();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }
  closeConnection();
});

// Error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  if (mainWindow) {
    mainWindow.webContents.send("uncaught-error", error.message);
  }
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
  if (mainWindow) {
    mainWindow.webContents.send("unhandled-rejection", error.message);
  }
});
