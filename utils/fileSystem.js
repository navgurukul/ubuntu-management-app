const fs = require("fs");
const {
  userDataPath,
  channelFilePath,
  configFilePath,
} = require("../config/paths");

function ensureUserDataFilesSync() {
  try {
    // Create userData directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Ensure channel.json exists
    if (!fs.existsSync(channelFilePath)) {
      fs.writeFileSync(
        channelFilePath,
        JSON.stringify({ currentChannel: [] }, null, 2),
        "utf8"
      );
      console.log("Created channel.json in userData directory");
    }

    // Ensure config.json exists
    if (!fs.existsSync(configFilePath)) {
      fs.writeFileSync(
        configFilePath,
        JSON.stringify({ channelSubmitted: false }, null, 2),
        "utf8"
      );
      console.log("Created config.json in userData directory");
    }
  } catch (error) {
    console.error("Error ensuring user data files:", error);
    throw error;
  }
}

// For backwards compatibility
function ensureUserDataFiles() {
  return new Promise((resolve, reject) => {
    try {
      ensureUserDataFilesSync();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { ensureUserDataFiles, ensureUserDataFilesSync };
