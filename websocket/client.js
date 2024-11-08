const WebSocket = require("ws");
const { getMacAddress } = require("../utils/system");
const { executeCommand } = require("../utils/commands");

let commandReceived = null;
global.rws = null;

function initializeWebSocket(channelNames) {
  if (global.rws && global.rws.readyState === WebSocket.OPEN) {
    console.log("WebSocket connection already exists");
    return;
  }

  global.rws = new WebSocket("wss://rms.thesama.in");

  console.log(`Connecting to WebSocket server with channels: ${channelNames}`);

  global.rws.on("open", () => {
    console.log("[Client] Connected to WebSocket server.");
    const message = JSON.stringify({
      type: "subscribe",
      channels: channelNames,
    });
    console.log("Sending message to server:", message);
    global.rws.send(message);
  });

  global.rws.on("message", async (data) => {
    try {
      let tempCommands = commandReceived;
      const dataObj = JSON.parse(data);
      const commands = dataObj.commands;

      commandReceived = commands;

      if (!Array.isArray(commands)) {
        console.error("Received commands is not an array:", commands);
        handleInvalidCommands();
        return;
      }

      if (JSON.stringify(tempCommands) !== JSON.stringify(commandReceived)) {
        try {
          for (const command of commands) {
            await executeCommand(command);
          }
          console.log("All commands executed successfully.");
        } catch (error) {
          console.error("Error executing commands:", error);
        }
      } else {
        console.log("Commands unchanged, skipping execution");
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  });

  global.rws.on("close", (event) => {
    console.log("[Client] Connection closed.", event.code, event.reason);
    global.rws = null;
  });

  global.rws.on("error", (error) => {
    console.error("[Client] Error:", error.message);
    global.rws = null;
  });
}

function handleInvalidCommands() {
  const macAddress = getMacAddress();
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

module.exports = { initializeWebSocket };
