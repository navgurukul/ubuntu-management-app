const fs = require("fs").promises;
const path = require("path");
const {
  userDataPath,
  channelFilePath,
  configFilePath,
} = require("../config/paths");

async function ensureUserDataFiles() {
  try {
    // Create userData directory if it doesn't exist
    try {
      await fs.access(userDataPath);
    } catch {
      await fs.mkdir(userDataPath, { recursive: true });
    }

    // Ensure channel.json exists
    try {
      await fs.access(channelFilePath);
    } catch {
      await fs.writeFile(
        channelFilePath,
        JSON.stringify({ currentChannel: [] }, null, 2),
        "utf8"
      );
      console.log("Created channel.json in userData directory");
    }

    // Ensure config.json exists
    try {
      await fs.access(configFilePath);
    } catch {
      await fs.writeFile(
        configFilePath,
        JSON.stringify({ channelSubmitted: false }, null, 2),
        "utf8"
      );
      console.log("Created config.json in userData directory");
    }
  } catch (error) {
    console.error("Error ensuring user data files:", error);
    throw error; // Rethrow to be caught by the caller
  }
}

// Synchronous version for other modules that require sync operations
function ensureUserDataFilesSync() {
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    if (!fs.existsSync(channelFilePath)) {
      fs.writeFileSync(
        channelFilePath,
        JSON.stringify({ currentChannel: [] }, null, 2),
        "utf8"
      );
    }

    if (!fs.existsSync(configFilePath)) {
      fs.writeFileSync(
        configFilePath,
        JSON.stringify({ channelSubmitted: false }, null, 2),
        "utf8"
      );
    }
  } catch (error) {
    console.error("Error ensuring user data files:", error);
    throw error;
  }
}

module.exports = {
  ensureUserDataFiles,
  ensureUserDataFilesSync,
};
