const WebSocket = require("ws");
const config = require("../config/paths");
const { getMacAddress } = require("../utils/system");
const { isOnline } = require("../utils/network");
const { executeCommand } = require("../utils/commands");
const fs = require("fs");
const path = require("path");

let commandReceived = null;
global.rws = null;
let reconnectInterval = null;

// Load commands.json file
let storedCommands = [];
const commandsFilePath = path.join(__dirname, "../config/commands.json");

function loadStoredCommands() {
  try {
    const data = fs.readFileSync(commandsFilePath, "utf8");
    storedCommands = JSON.parse(data);
    console.log("Stored commands loaded:", storedCommands);
  } catch (error) {
    console.error("Error reading commands.json file:", error);
  }
}

// Find if a command exists in the storedCommands array
function isCommandInStoredList(command) {
  return storedCommands.find(
    (storedCommand) => storedCommand.command === command
  );
}

// Add new command to storedCommands array and update commands.json
function addCommandToStoredList(command) {
  storedCommands.push(command);  // Push new command to the array
  try {
    fs.writeFileSync(commandsFilePath, JSON.stringify(storedCommands, null, 2)); // Write updated array back to the file
    console.log("New command added to commands.json");
  } catch (error) {
    console.error("Error writing to commands.json file:", error);
  }
}

// Initialize WebSocket and load commands
function initializeWebSocket(channelNames) {
  try {
    if (global.rws && global.rws.readyState === WebSocket.OPEN) {
      console.log("WebSocket connection already exists");
      return;
    }

    console.log(`Connecting to WebSocket server with channels: ${channelNames}`);
    global.rws = new WebSocket(config.wsUrl);

    global.rws.on("open", () => {
      console.log("[Client] Connected to WebSocket server.");

      // Prepare the subscription message
      const message = JSON.stringify({
        type: "subscribe",
        channels: channelNames,
      });

      console.log("Sending subscription message:", message);
      global.rws.send(message);
    });

    global.rws.on("message", async (data) => {
      try {
        let tempCommands = commandReceived;
        const dataObj = JSON.parse(data);
        const commands = dataObj.commands;

        const macAddress = getMacAddress();

        if (!Array.isArray(commands)) {
          console.error("Received commands is not an array:", commands);
          handleInvalidCommands(macAddress);
          return;
        }

        // Filter out commands that are in commands.json and should not be repeated
        const newCommands = commands.filter((command) => {
          const storedCommand = isCommandInStoredList(command);
          return !storedCommand || storedCommand.shouldRepeat;
        });

        if (newCommands.length === 0) {
          console.log("No new commands to execute. All commands are ignored.");
          return;
        }

        // Only execute if commands have changed
        if (JSON.stringify(tempCommands) !== JSON.stringify(newCommands)) {
          console.log("New commands received, executing...");
          commandReceived = newCommands;

          try {
            for (const command of newCommands) {
              // If the command is not in the storedCommands, add it
              if (!isCommandInStoredList(command)) {
                addCommandToStoredList(command);
              }
              await executeCommand(command);
            }
            console.log("All new commands executed successfully.");
          } catch (error) {
            console.error("Error executing commands:", error);
            handleCommandError(macAddress);
          }
        } else {
          console.log("Commands unchanged, skipping execution");
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    global.rws.on("close", (event) => {
      console.log("[Client] Connection closed.", event.code, event.reason);
      handleWebSocketClose();
    });

    global.rws.on("error", (error) => {
      console.error("[Client] WebSocket error:", error.message);
      handleWebSocketError();
    });
  } catch (error) {
    console.error("Error initializing WebSocket:", error);
    handleWebSocketError();
  }
}

function handleInvalidCommands(macAddress) {
  if (global.rws && global.rws.readyState === WebSocket.OPEN) {
    global.rws.send(
      JSON.stringify({
        success: false,
        mac: macAddress,
        error: "Commands is not an array",
      })
    );
  }
}

function handleCommandError(macAddress) {
  if (global.rws && global.rws.readyState === WebSocket.OPEN) {
    global.rws.send(
      JSON.stringify({
        success: false,
        mac: macAddress,
        error: "Command execution failed",
      })
    );
  }
}

function handleWebSocketClose() {
  global.rws = null;
  commandReceived = null;
}

function handleWebSocketError() {
  if (global.rws) {
    global.rws.close();
  }
  global.rws = null;
  commandReceived = null;
}

function checkNetworkAndReconnect(channelNames) {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }

  reconnectInterval = setInterval(async () => {
    if (await isOnline()) {
      if (!global.rws || global.rws.readyState === WebSocket.CLOSED) {
        console.log("Network is online. Attempting to reconnect...");
        initializeWebSocket(channelNames);
      }
    } else {
      console.log("Network is offline. Waiting to reconnect...");
      if (global.rws) {
        global.rws.close();
        global.rws = null;
      }
    }
  }, config.networkCheckInterval);

  // Initial connection attempt
  initializeWebSocket(channelNames);
}

// Load stored commands at startup
loadStoredCommands();

module.exports = {
  initializeWebSocket,
  checkNetworkAndReconnect,
};
