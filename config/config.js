// config/paths.js
const { app } = require("electron");
const path = require("path");

// Get user directories
const userDataPath = app.getPath("userData");
const homeDir = app.getPath("home");
const ubuntuManagementDir = path.join(homeDir, ".ubuntu-management");

// Configuration object
const config = {
  // Paths
  userDataPath: userDataPath,
  ubuntuManagementDir: ubuntuManagementDir,

  // Files in userData (for backward compatibility)
  channelFilePath: path.join(userDataPath, "channel.json"),
  configFilePath: path.join(userDataPath, "config.json"),
  macFilePath: path.join(userDataPath, "mac_address.json"),

  // Database in user's home directory
  dbPath: path.join(ubuntuManagementDir, "system_tracking.db"),

  // URLs
  wsUrl: "wss://rms.thesama.in",
  syncUrl: "https://rms.thesama.in/database-sync",
  locationApiUrl: "http://ip-api.com/json/",

  // Intervals
  syncInterval: 600000, // 10 minutes in milliseconds
  networkCheckInterval: 5000, // 5 seconds in milliseconds

  // Database configuration
  maxBackups: 5, // Maximum number of database backups to keep

  // Function to get backup path with timestamp
  getBackupPath: function (timestamp) {
    return path.join(this.ubuntuManagementDir, `backup_${timestamp}.db`);
  },
};

module.exports = config;
