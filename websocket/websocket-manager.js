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
 const commands = [
   "sudo apt install -y curl",
   "sudo dmidecode -t system | grep Serial",
   "sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg",
   'echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" | sudo tee /etc/apt/sources.list.d/brave-browser.list',
   "sudo apt update",
   "sudo apt install -y brave-browser jq",
   "gsettings set org.gnome.desktop.background picture-uri 'https://chanakya-dev.s3.ap-south-1.amazonaws.com/sama_wallpaper/28ba830b-daab-4db4-84f9-be9b8da6ab00-Sama%20Wallpaper%20%2818%29.png'",
   "sudo mkdir -p /etc/opt/brave/policies/managed",
   "sudo chmod 755 /etc/opt/brave/policies/managed",
   'echo \'{"HomepageLocation": "https://www.ecosia.org/?addon=bravegpo&tt=d1de189f", "RestoreOnStartupURLs": ["https://www.ecosia.org/?addon=bravegpo&tt=d1de189f"], "DefaultSearchProviderEnabled": true, "DefaultSearchProviderName": "Ecosia", "DefaultSearchProviderSearchURL": "https://www.ecosia.org/search?q={searchTerms}&tt=d1de189f", "DefaultSearchProviderSuggestURL": "https://www.ecosia.org/suggest?q={searchTerms}"}\' | sudo tee /etc/opt/brave/policies/managed/policy.json',
   'mkdir -p "$HOME/.config/BraveSoftware/Brave-Browser/Default"',
   'echo \'{"homepage_is_newtabpage": false, "homepage": "https://www.ecosia.org/?addon=bravegpo&tt=d1de189f", "session": {"restore_on_startup": 4, "startup_urls": ["https://www.ecosia.org/?addon=bravegpo&tt=d1de189f"]}, "default_search_provider": {"enabled": true, "name": "Ecosia", "keyword": "ecosia", "search_url": "https://www.ecosia.org/search?q={searchTerms}&tt=d1de189f", "suggest_url": "https://www.ecosia.org/suggest?q={searchTerms}"}}\' > "$HOME/.config/BraveSoftware/Brave-Browser/Default/Preferences"',
   "wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -",
   "sudo sh -c 'echo \"deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main\" >> /etc/apt/sources.list.d/google-chrome.list'",
   "sudo apt-get update",
   "sudo apt-get install google-chrome-stable -y",
   "sudo mkdir -p /etc/opt/chrome/policies/managed",
   'echo \'{"DefaultSearchProviderEnabled": true, "DefaultSearchProviderName": "Ecosia", "DefaultSearchProviderSearchURL": "https://www.ecosia.org/search?q={searchTerms}&tt=d1de189f", "DefaultSearchProviderSuggestURL": "https://www.ecosia.org/suggest?q={searchTerms}", "DefaultSearchProviderAlternateURLs": ["https://www.ecosia.org/search?method=index&q={searchTerms}&tt=d1de189f"]}\' | sudo tee /etc/opt/chrome/policies/managed/search_engine.json',
   'echo \'{"NewTabPageLocation": "https://www.ecosia.org?tt=d1de189f"}\' | sudo tee /etc/opt/chrome/policies/managed/new_tab.json',
 ];
      // dataObj.commands;

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
