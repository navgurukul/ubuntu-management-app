// services/websocketService.js
const WebSocket = require("ws");
const config = require("../config/config");
const { executeCommand } = require("../handlers/commandHandler");
const { isOnline } = require("../utils/networkUtils");
const { getMacAddress } = require("../services/systemService");

let ws = null;
let commandReceived = null;

function initializeWebSocket(channelNames) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  ws = new WebSocket(config.wsUrl);

  ws.on("open", () => {
    console.log("[Client] Connected to WebSocket server.");
    const message = JSON.stringify({
      type: "subscribe",
      channels: channelNames,
    });
    ws.send(message);
  });

  ws.on("message", async (data) => {
    try {
      let tempCommands = commandReceived;
      const dataObj = JSON.parse(data);
      const commands = dataObj.commands;
      commandReceived = commands;

      if (!Array.isArray(commands)) {
        console.error("Received commands is not an array:", commands);
        ws.send(
          JSON.stringify({
            success: false,
            mac: getMacAddress(),
            error: "Commands is not an array",
          })
        );
        return;
      }

      if (tempCommands !== commandReceived) {
        try {
          for (const command of commands) {
            await executeCommand(command, ws);
          }
        } catch (error) {
          console.error("Error executing commands:", error);
          ws.send(
            JSON.stringify({
              success: false,
              mac: getMacAddress(),
            })
          );
        }
      }
    } catch (error) {
      console.error("Error parsing JSON:", error.message);
    }
  });

  ws.on("close", (event) => {
    console.log("[Client] Connection closed.", event.code, event.reason);
    ws = null;
  });

  ws.on("error", (error) => {
    console.error("[Client] WebSocket error:", error.message);
  });

  return ws;
}

async function checkNetworkAndReconnect(channelNames) {
  if (!(await isOnline())) {
    console.log("Network is offline. Will retry connection...");
    return;
  }

  if (!ws || ws.readyState === WebSocket.CLOSED) {
    console.log("Attempting to reconnect WebSocket...");
    initializeWebSocket(channelNames);
  }
}

function closeConnection() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
    ws = null;
  }
}

function getWebSocket() {
  return ws;
}

module.exports = {
  initializeWebSocket,
  checkNetworkAndReconnect,
  closeConnection,
  getWebSocket,
};
