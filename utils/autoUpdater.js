const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

function setupAutoUpdater() {
  // Configure logging
  log.transports.file.level = "debug";
  autoUpdater.logger = log;

  // Configure auto updater for silent updates
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Disable notifications
  autoUpdater.logger = null; // Disable logging to screen
  autoUpdater.allowPrerelease = false;

  // Add event handlers
  autoUpdater.on("error", (error) => {
    log.error("Error during auto-update:", error);
  });

  autoUpdater.on("update-available", () => {
    log.info("Update available. Downloading silently...");
  });

  autoUpdater.on("update-downloaded", () => {
    log.info("Update downloaded. Installing silently...");
    // Use quitAndInstall with silent options
    // isSilent = true, isForceRunAfter = true
    autoUpdater.quitAndInstall(true, true);
  });

  // Check for updates without notification
  autoUpdater.checkForUpdates(); // Instead of checkForUpdatesAndNotify()
}

module.exports = { setupAutoUpdater };
