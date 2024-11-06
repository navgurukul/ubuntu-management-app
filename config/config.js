const { app } = require("electron");
const path = require("path");

const config = {
  userDataPath: app.getPath("userData"),
  channelFilePath: path.join(app.getPath("userData"), "channel.json"),
  configFilePath: path.join(app.getPath("userData"), "config.json"),
  dbPath: path.join(app.getPath("userData"), "system_tracking.db"),
  wsUrl: "wss://rms.thesama.in",
  syncUrl: "https://rms.thesama.in/database-sync",
  locationApiUrl: "http://ip-api.com/json/",
  syncInterval: 600000, // 10 minutes
};

module.exports = config;
