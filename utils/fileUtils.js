const fs = require("fs");
const config = require("../config/config");

function ensureUserDataFiles() {
  try {
    if (!fs.existsSync(config.userDataPath)) {
      fs.mkdirSync(config.userDataPath, { recursive: true });
    }

    if (!fs.existsSync(config.channelFilePath)) {
      fs.writeFileSync(
        config.channelFilePath,
        JSON.stringify({ currentChannel: [] }, null, 2),
        "utf8"
      );
    }

    if (!fs.existsSync(config.configFilePath)) {
      fs.writeFileSync(
        config.configFilePath,
        JSON.stringify({ channelSubmitted: false }, null, 2),
        "utf8"
      );
    }
  } catch (error) {
    console.error("Error ensuring user data files:", error);
  }
}

function readConfig() {
  try {
    ensureUserDataFiles();
    const data = fs.readFileSync(config.configFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading config file:", error);
    return { channelSubmitted: false };
  }
}

function writeConfig(configData) {
  try {
    ensureUserDataFiles();
    fs.writeFileSync(
      config.configFilePath,
      JSON.stringify(configData, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Error writing config file:", error);
  }
}

module.exports = {
  ensureUserDataFiles,
  readConfig,
  writeConfig,
};
