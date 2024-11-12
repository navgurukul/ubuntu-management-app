const WebSocket = require("ws");
const config = require("../config/paths");
const { getMacAddress } = require("../utils/system");
const { isOnline } = require("../utils/network");
const { executeCommand } = require("../utils/commands");

let ws = null;
let commandReceived = null;
let reconnectInterval = null;

function initializeWebSocket(channelNames) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("WebSocket connection already exists");
    return;
  }

  console.log(`Connecting to WebSocket server with channels: ${channelNames}`);
  ws = new WebSocket(config.wsUrl);
  global.rws = ws;

  setupWebSocketHandlers(channelNames);
  checkConnection(channelNames);
}

function setupWebSocketHandlers(channelNames) {
  ws.on("open", () => {
    console.log("[Client] Connected to WebSocket server.");
    const message = JSON.stringify({
      type: "subscribe",
      channels: channelNames,
    });
    ws.send(message);
  });

  ws.on("message", handleMessage);
  ws.on("close", () => handleClose(channelNames));
  ws.on("error", (error) => handleError(error, channelNames));
}

async function handleMessage(data) {
  try {
    let tempCommands = commandReceived;
    const dataObj = JSON.parse(data);
    const commands = dataObj.commands;

    if (!Array.isArray(commands)) {
      console.error("Received commands is not an array:", commands);
      sendResponse(false, "Commands is not an array");
      return;
    }

    if (JSON.stringify(tempCommands) !== JSON.stringify(commands)) {
      commandReceived = commands;
      await executeCommands(commands);
    } else {
      console.log("Commands unchanged, skipping execution");
    }
  } catch (error) {
    console.error("Error handling message:", error);
    sendResponse(false, error.message);
  }
}

function handleClose(channelNames) {
  console.log("[Client] Connection closed.");
  cleanup();
  checkConnection(channelNames);
}

function handleError(error, channelNames) {
  console.error("[Client] WebSocket error:", error);
  cleanup();
  checkConnection(channelNames);
}

function cleanup() {
  if (ws) {
    try {
      ws.close();
    } catch (error) {
      console.error("Error closing WebSocket:", error);
    }
  }
  ws = null;
  global.rws = null;
}

function checkConnection(channelNames) {
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
  }

    reconnectInterval = setInterval(async () => {
        if (await isOnline()) {
            if (!ws || ws.readyState === WebSocket.CLOSED) {
                console.log("Network is online. Attempting to reconnect...");
                initializeWebSocket(channelNames);
            }
        } else {
            console.log("Network is offline. Waiting to reconnect...");
            cleanup();
        }
    }, config.networkCheckInterval),config.reconnectInterval}

async function executeCommands(commands) {
  try {
    for (const command of commands) {
      await executeCommand(command);
    }
    sendResponse(true, "Commands executed successfully");
  } catch (error) {
    console.error("Error executing commands:", error);
    sendResponse(false, "Error executing commands");
  }
}

function sendResponse(success, message = "") {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        success,
        mac: getMacAddress(),
        message,
      })
    );
  }
}

module.exports = {
  initializeWebSocket,
  checkConnection, // Now properly exported
};
