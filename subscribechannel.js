const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Path to the JSON file
const channelFilePath = path.join(__dirname, "channel.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to get current channels from JSON file
function getCurrentChannels() {
  try {
    const data = fs.readFileSync(channelFilePath, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData.currentChannel || []; // Return an empty array if no channels exist
  } catch (error) {
    console.error("Error reading channel data:", error);
    return []; // Return empty array on error
  }
}

// Function to update the current channels in JSON file
function setCurrentChannels(channels) {
  try {
    const data = { currentChannel: channels };
    fs.writeFileSync(channelFilePath, JSON.stringify(data, null, 2));
    console.log(`Current Channel updated to: ${channels.join(", ")}`);
  } catch (error) {
    console.error("Error writing channel data:", error);
  }
}

// Prompt user for new channel names
rl.question(
  "Please enter the new channel names (comma-separated): ",
  (input) => {
    // Split input by commas and trim whitespace
    const newChannelNames = input
      .split(",")
      .map((channel) => channel.trim())
      .filter(Boolean); // Remove empty strings

    // Get existing channels
    const currentChannels = getCurrentChannels();

    // If there are any new channels provided, replace the existing one
    if (newChannelNames.length > 0) {
      // Replace existing channels with the new ones
      setCurrentChannels(newChannelNames);
    } else {
      console.log("No valid channel names provided.");
    }

    rl.close();
  }
);
