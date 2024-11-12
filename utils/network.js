// utils/network.js
const dns = require("dns");

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

async function checkNetworkAndReconnect(channelNames, callback) {
  if (await isOnline()) {
    callback(channelNames);
  } else {
    console.log("Network is offline. Waiting to reconnect...");
  }
}

module.exports = {
  isOnline,
  checkNetworkAndReconnect,
};
