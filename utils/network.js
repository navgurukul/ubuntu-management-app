const WebSocket = require("ws");
const dns = require("dns");
const { initializeWebSocket } = require("../websocket/client");

function isOnline() {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => {
      if (err && err.code === "ENOTFOUND") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function checkNetworkAndReconnect(channelNames) {
  setInterval(async () => {
    if (await isOnline()) {
      if (!global.rws || global.rws.readyState === WebSocket.CLOSED) {
        initializeWebSocket(channelNames);
        console.log("Network is online. Reconnecting WebSocket...");
      }
    } else {
      console.log("Network is offline. Waiting to reconnect WebSocket...");
      if (global.rws) {
        global.rws.close();
        global.rws = null;
      }
    }
  }, 5000);
}

module.exports = { isOnline, checkNetworkAndReconnect };
