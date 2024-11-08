const { app } = require("electron");
const { createWindow } = require("./windows/mainWindow");
const fileSystem = require("./utils/fileSystem");
const { setupAutoUpdater } = require("./utils/autoUpdater");
const { startPeriodicTasks } = require("./utils/periodicTasks");
const { initializeDatabase } = require("./utils/database");

// Configure app
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");

let mainWindow = null;

app.whenReady().then(() => {
  try {
    fileSystem.ensureUserDataFilesSync(); // Use sync version here
    initializeDatabase();
    mainWindow = createWindow();
    startPeriodicTasks();
    setupAutoUpdater();
  } catch (error) {
    console.error("Error during app initialization:", error);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  const { BrowserWindow } = require("electron");
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});
