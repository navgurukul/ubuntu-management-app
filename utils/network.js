const dns = require("dns");
const WebSocket = require("ws");

function isOnline() {
  return new Promise((resolve) => {
    dns.lookup("google.com", (err) => {
      resolve(!err || err.code !== "ENOTFOUND");
    });
  });
}

function checkNetworkAndReconnect(channelNames) {
  setInterval(async () => {
    if (await isOnline()) {
      if (!global.rws || global.rws.readyState === WebSocket.CLOSED) {
        const { initializeWebSocket } = require("../websocket/client");
        initializeWebSocket(channelNames);
        console.log("Network is online. Reconnecting WebSocket...");
      }
    } else {
      console.log("Network is offline. Waiting to reconnect WebSocket...");
    }
  }, 5000);
}

module.exports = { isOnline, checkNetworkAndReconnect };
