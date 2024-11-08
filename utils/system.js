// utils/system.js
const os = require("os");
const fs = require("fs");
const path = require("path");
const { userDataPath } = require("../config/paths");

// Path for storing MAC address
const macAddressFile = path.join(userDataPath, "mac_address.json");

function saveMacAddress(macAddress) {
  try {
    // Ensure userDataPath exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    fs.writeFileSync(macAddressFile, JSON.stringify({ macAddress }, null, 2));
    console.log("MAC address saved successfully:", macAddress);
  } catch (error) {
    console.error("Error saving MAC address:", error);
  }
}

function getStoredMacAddress() {
  try {
    if (fs.existsSync(macAddressFile)) {
      const data = fs.readFileSync(macAddressFile, "utf8");
      const { macAddress } = JSON.parse(data);
      return macAddress;
    }
  } catch (error) {
    console.error("Error reading stored MAC address:", error);
  }
  return null;
}

function getMacAddress() {
  // First try to get the actual MAC address
  const networkInterfaces = os.networkInterfaces();
  for (let interfaceName in networkInterfaces) {
    const networkDetails = networkInterfaces[interfaceName];
    for (let detail of networkDetails) {
      if (detail.mac && detail.mac !== "00:00:00:00:00:00") {
        // If we find a valid MAC address, save it
        saveMacAddress(detail.mac);
        return detail.mac;
      }
    }
  }

  // If no MAC address found, try to get the stored one
  const storedMac = getStoredMacAddress();
  if (storedMac) {
    console.log("Using stored MAC address:", storedMac);
    return storedMac;
  }

  return "Unknown MAC Address";
}

function formatActiveTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

// Optional: function to verify if current MAC matches stored MAC
function verifyMacAddress() {
  const currentMac = getCurrentMacAddress(); // Get current MAC without saving
  const storedMac = getStoredMacAddress();

  if (currentMac && storedMac && currentMac !== storedMac) {
    console.warn(
      "Warning: Current MAC address differs from stored MAC address"
    );
    console.warn(`Stored: ${storedMac}, Current: ${currentMac}`);
  }
}

// Helper function to get current MAC without saving
function getCurrentMacAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (let interfaceName in networkInterfaces) {
    const networkDetails = networkInterfaces[interfaceName];
    for (let detail of networkDetails) {
      if (detail.mac && detail.mac !== "00:00:00:00:00:00") {
        return detail.mac;
      }
    }
  }
  return null;
}

module.exports = {
  getMacAddress,
  formatActiveTime,
  getStoredMacAddress,
  verifyMacAddress,
};
