// websocket/client.js
const WebSocket = require("ws");
const { getMacAddress } = require("../utils/system");
const { executeCommand } = require("../utils/commands");

let commandReceived;
global.rws = null;

function initializeWebSocket(channelNames) {
  global.rws = new WebSocket("wss://rms.thesama.in");

  console.log(`Connecting to WebSocket server with channels: ${channelNames}`);

  global.rws.on("open", () => {
    console.log("[Client] Connected to WebSocket server.");
    const message = JSON.stringify({
      type: "subscribe",
      channels: channelNames,
    });
    global.rws.send(message);
  });

  global.rws.on("message", handleWebSocketMessage);
  global.rws.on("close", handleWebSocketClose);
  global.rws.on("error", handleWebSocketError);
}

async function handleWebSocketMessage(data) {
  try {
    let tempCommands = commandReceived;
    const dataObj = JSON.parse(data);
    const commands = dataObj.commands;
    commandReceived = commands;

    const macAddress = getMacAddress();

    if (!Array.isArray(commands)) {
      console.error("Received commands is not an array:", commands);
      global.rws.send(
        JSON.stringify({
          success: false,
          mac: macAddress,
          error: "Commands is not an array",
        })
      );
      return;
    }

    if (tempCommands !== commandReceived) {
      try {
        for (const command of commands) {
          await executeCommand(command);
        }
        global.rws.send(
          JSON.stringify({
            success: true,
            mac: macAddress,
          })
        );
      } catch (error) {
        console.error("Error executing commands:", error);
        global.rws.send(
          JSON.stringify({
            success: false,
            mac: macAddress,
          })
        );
      }
    }
  } catch (error) {
    console.error("Error parsing JSON:", error.message);
  }
}

function handleWebSocketClose(event) {
  console.log("[Client] Connection closed.", event.code, event.reason);
}

function handleWebSocketError(error) {
  console.error("[Client] Error:", error.message);
}

module.exports = { initializeWebSocket };
