// websocket/client.js
const WebSocket = require("ws");
const config = require("../config/paths");
const { getMacAddress } = require("../utils/system");
const { isOnline } = require("../utils/network");
const { executeCommand } = require("../utils/commands");

let commandReceived = null;
global.rws = null;
let reconnectInterval = null;

function initializeWebSocket(channelNames) {
  try {
    if (global.rws && global.rws.readyState === WebSocket.OPEN) {
      console.log("WebSocket connection already exists");
      return;
    }

    console.log(
      `Connecting to WebSocket server with channels: ${channelNames}`
    );
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

        // Only execute if commands have changed
        if (JSON.stringify(tempCommands) !== JSON.stringify(commands)) {
          console.log("New commands received, executing...");
          commandReceived = commands;

          try {
            for (const command of commands) {
              await executeCommand(command);
            }
            console.log("All commands executed successfully.");
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

module.exports = {
  initializeWebSocket,
  checkNetworkAndReconnect,
};
