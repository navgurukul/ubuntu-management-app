const fs = require("fs");
const { configFilePath } = require("../config/paths");
const { ensureUserDataFilesSync } = require("./fileSystem");

function readConfig() {
  try {
    ensureUserDataFilesSync();
    const data = fs.readFileSync(configFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading config file:", error);
    return { channelSubmitted: false };
  }
}

function writeConfig(config) {
  try {
    ensureUserDataFilesSync();
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to config file:", error);
  }
}

module.exports = { readConfig, writeConfig };
