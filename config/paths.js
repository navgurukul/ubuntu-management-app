const path = require("path");
const { app } = require("electron");

const userDataPath = app.getPath("userData");

module.exports = {
  channelFilePath: path.join(userDataPath, "channel.json"),
  configFilePath: path.join(userDataPath, "config.json"),
  dbPath: path.join(app.getPath("userData"), "system_tracking.db"),
};

// utils/network.js
const dns = require("dns");

function isOnline() {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => {
      if (err && err.code === "ENOTFOUND") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

module.exports = { isOnline };
