const fs = require("fs");
const { app } = require("electron");
const { channelFilePath } = require("../config/paths");
const { ensureUserDataFilesSync } = require("./fileSystem");
const { readConfig, writeConfig } = require("./config");

function getCurrentChannel() {
  try {
    ensureUserDataFilesSync();
    const data = fs.readFileSync(channelFilePath, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData.currentChannel || [];
  } catch (error) {
    console.error("Error reading channel data:", error);
    return [];
  }
}

function saveChannelName(channelName) {
  try {
    ensureUserDataFilesSync();
    const data = { currentChannel: [channelName] };
    fs.writeFileSync(channelFilePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`Channel name saved to userData: ${channelName}`);
  } catch (error) {
    console.error("Error saving channel name:", error);
  }
}

module.exports = { getCurrentChannel, saveChannelName };
