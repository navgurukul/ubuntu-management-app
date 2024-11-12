// main.js
const { app, BrowserWindow } = require("electron");
const path = require("path");
const config = require("./config/paths");
const { createWindow } = require("./windows/mainWindow");
const { setupAutoUpdater } = require("./utils/autoUpdater");
const { startPeriodicTasks } = require("./utils/periodicTasks");
const { initializeDatabase, closeDatabase } = require("./utils/database");
const { ensureUserDataFiles } = require("./utils/fileSystem");

let mainWindow = null;

async function initialize() {
  try {
    console.log("Starting application initialization...");

    // Ensure all required directories and files exist
    await ensureUserDataFiles();
    console.log("User data files verified");

    // Initialize database
    await initializeDatabase();
    console.log("Database initialized successfully");

    // Create window
    mainWindow = createWindow();
    console.log("Main window created");

    // Start background tasks
    startPeriodicTasks();
    console.log("Periodic tasks started");

    // Setup auto updater
    setupAutoUpdater();
    console.log("Auto updater configured");
  } catch (error) {
    console.error("Error during application initialization:", error);
    if (error.code === "SQLITE_CANTOPEN") {
      console.error(
        "Failed to open database. Check permissions and disk space."
      );
    }
    app.exit(1);
  }
}

// App event handlers
app.whenReady().then(initialize);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow();
  }
});

// Handle app shutdown
app.on("before-quit", async (event) => {
  try {
    await closeDatabase();
    console.log("Database closed successfully");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
});

// Handle errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
