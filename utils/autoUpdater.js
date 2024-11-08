const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

function setupAutoUpdater() {
  // Configure logging
  log.transports.file.level = "debug";
  autoUpdater.logger = log;

  // Configure auto updater
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Add event handlers
  autoUpdater.on("update-available", () => {
    log.info("Update available.");
  });

  autoUpdater.on("update-downloaded", () => {
    log.info("Update downloaded. Installing...");
    autoUpdater.quitAndInstall();
  });

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify();
}

module.exports = { setupAutoUpdater };
