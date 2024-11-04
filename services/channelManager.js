const fs = require("fs");
const { CHANNEL_FILE_PATH } = require("../config/constants");

class ChannelManager {
  static getCurrentChannel() {
    try {
      const data = fs.readFileSync(CHANNEL_FILE_PATH, "utf8");
      const parsedData = JSON.parse(data);
      return parsedData.currentChannel || [];
    } catch (error) {
      console.error("Error reading channel data:", error);
      return [];
    }
  }

  static saveChannelName(channelName) {
    const data = { currentChannel: [channelName] };
    fs.writeFileSync(CHANNEL_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
    console.log(`Channel name saved: ${channelName}`);
  }

  static resetChannel() {
    return new Promise((resolve, reject) => {
      fs.unlink(CHANNEL_FILE_PATH, (err) => {
        if (err) {
          console.error("Error deleting channel.json:", err);
          reject(err);
        } else {
          console.log("Channel reset successful. 'channel.json' deleted.");
          resolve();
        }
      });
    });
  }
}

module.exports = ChannelManager;
