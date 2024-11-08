const { syncDatabase } = require("./sync");
const { logStatus } = require("./tracking");

function startPeriodicTasks() {
  // Initial runs
  syncDatabase();
  logStatus();

  // Set up intervals
  setInterval(syncDatabase, 600000); // 10 minutes
  setInterval(logStatus, 60000); // 1 minute
}

module.exports = { startPeriodicTasks };
