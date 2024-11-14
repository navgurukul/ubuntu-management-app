// config/paths.js
const { app } = require("electron");
const path = require("path");

const userDataPath = app.getPath("userData");
const databaseDir = path.join(userDataPath, "databases");

const homeDir = app.getPath("home");
const ubuntuManagementDir = path.join(homeDir, ".ubuntu-management");

const config = {
  // Base directories
  userDataPath: userDataPath,
  databaseDir: databaseDir,

  // Configuration files
  channelFilePath: path.join(userDataPath, "channel.json"),
  configFilePath: path.join(userDataPath, "config.json"),
  macFilePath: path.join(userDataPath, "mac_address.json"),

  ubuntuManagementDir: ubuntuManagementDir,
  // Database - stored in userDataPath/databases
  dbPath: path.join(databaseDir, "system_tracking.db"),

  // URLs
  wsUrl: "wss://rms.thesama.in",
  syncUrl: "https://rms.thesama.in/database-sync",
  locationApiUrl: "http://ip-api.com/json/",

  // Intervals
  syncInterval: 600000, // 10 minutes
  reconnectInterval: 60000, // 1 minute
  networkCheckInterval: 5000, // 5 seconds

  // Database settings
  maxBackups: 5,
  retentionDays: 30,
};

module.exports = config;
