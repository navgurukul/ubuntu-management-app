const { app } = require("electron");
const path = require("path");

module.exports = {
  CHANNEL_FILE_PATH: path.join(app.getPath("userData"), "channel.json"),
  DB_PATH: path.join(__dirname, "../system_tracking.db"), // Adjusted to point to root
  WEBSOCKET_URL: "wss://rms.thesama.in",
  SYNC_INTERVAL: 10000,
  LOG_INTERVAL: 60000,
};
