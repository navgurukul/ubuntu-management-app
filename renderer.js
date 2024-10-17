const WebSocket = require("ws");
const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");

// Path to the JSON file for channels
const channelFilePath = path.join(__dirname, "channel.json");

// Function to read current channel from JSON file
function getCurrentChannel() {
  try {
    const data = fs.readFileSync(channelFilePath, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData.currentChannel || []; // Return an empty array if no channels exist
  } catch (error) {
    console.error("Error reading channel data:", error);
    return [];
  }
}

let channelNames = getCurrentChannel(); // Expecting an array of channels
console.log(`Initial Channel Names loaded: ${channelNames.join(", ")}`);

const rws = new WebSocket("wss://rms.thesama.in");

rws.on("open", () => {
  console.log("[Client] Connected to WebSocket server.");

  // Prepare the subscription message
  const message = JSON.stringify({
    type: "subscribe",
    channels: channelNames,
  });

  rws.send(message); // Send subscription message on connection open
});

rws.on("message", async (data) => {
  const dataObj = JSON.parse(data);
  const commands = dataObj.commands;

  if (!Array.isArray(commands)) {
    console.error("Received commands is not an array:", commands);
    return; // Exit early if commands is not an array
  }

  try {
    for (const command of commands) {
      await executeCommand(command); // Send each command to be executed in main process
    }

    console.log("All commands executed.");
  } catch (error) {
    console.error("An error occurred while executing commands:", error);
  }
});

rws.on("close", () => {
  console.log("[Client] Connection closed.");
});

rws.on("error", (error) => {
  console.error("[Client] Error: " + error.message);
});

// Function to execute commands via IPC
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    ipcRenderer.send("execute-command", command); // Send command to main process

    ipcRenderer.once("command-result", (event, result) => {
      // Listen for result from main process
      if (result.success) {
        resolve(result.result);
      } else {
        reject(new Error(result.error));
      }
    });
  });
}
