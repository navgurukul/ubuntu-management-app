const { app } = require("electron");
const path = require("path");

const userDataPath = app.getPath("userData");
module.exports = {
  channelFilePath: path.join(userDataPath, "channel.json"),
  configFilePath: path.join(userDataPath, "config.json"),
  dbPath: path.join(userDataPath, "system_tracking.db"),
  userDataPath,
};
