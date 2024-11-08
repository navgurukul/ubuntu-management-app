const os = require("os");

function getMacAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (let interfaceName in networkInterfaces) {
    const networkDetails = networkInterfaces[interfaceName];
    for (let detail of networkDetails) {
      if (detail.mac && detail.mac !== "00:00:00:00:00:00") {
        return detail.mac;
      }
    }
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

module.exports = { getMacAddress, formatActiveTime };
