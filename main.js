const { app, BrowserWindow } = require("electron");
const path = require("path");
const WebSocket = require("ws");
const { exec } = require("child_process");
const os = require("os");
const fs = require("fs");
const https = require("https");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");

// Path to the JSON file
const channelFilePath = path.join(__dirname, "channel.json");

// Database path for tracking
const dbPath = path.join(__dirname, "system_tracking.db");

// Create and initialize the database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the database.");
  }
});

// Enable foreign key support and create the table if it doesn't exist
db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON;`);
  db.run(`
        CREATE TABLE IF NOT EXISTS system_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mac_address VARCHAR(17) NOT NULL,
            username TEXT NOT NULL,
            active_time INTEGER NOT NULL,
            date DATE NOT NULL,
            location TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);
});

// Function to read current channel from JSON file
function getCurrentChannel() {
  try {
    const data = fs.readFileSync(channelFilePath, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData.currentChannel || [];
  } catch (error) {
    console.error("Error reading channel data:", error);
    return [];
  }
}

let channelNames = getCurrentChannel();
console.log(`Initial Channel Names loaded: ${channelNames.join(", ")}`);

// WebSocket connection
const rws = new WebSocket("wss://rms.thesama.in");

rws.on("open", () => {
  console.log("[Client] Connected to WebSocket server.");
  const message = JSON.stringify({
    type: "subscribe",
    channels: channelNames,
  });
  rws.send(message);
});

rws.on("message", async (data) => {
  const dataObj = JSON.parse(data);
  const commands = dataObj.commands;

  if (!Array.isArray(commands)) {
    console.error("Received commands is not an array:", commands);
    return;
  }

  try {
    for (const command of commands) {
      await executeCommand(command);
    }
    rws.send(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("An error occurred while executing commands:", error);
    rws.send(JSON.stringify({ success: false }));
  }
});

rws.on("error", (error) => {
  console.error("[Client] Error: " + error.message);
});

// Function to get MAC address
function getMacAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (let interfaceName in networkInterfaces) {
    const networkDetails = networkInterfaces[interfaceName];
    for (let i = 0; i < networkDetails.length; i++) {
      if (
        networkDetails[i].mac &&
        networkDetails[i].mac !== "00:00:00:00:00:00"
      ) {
        return networkDetails[i].mac;
      }
    }
  }
  return "Unknown MAC Address";
}

// Function to sync database with server
async function syncDatabase() {
  const dbInstance = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READONLY,
    (err) => {
      if (err) return console.error("Error opening database:", err.message);

      dbInstance.all(`SELECT * FROM system_tracking`, async (err, rows) => {
        if (err)
          return console.error("Error reading from database:", err.message);

        try {
          const response = await axios.post(
            "https://rms.thesama.in/database-sync",
            { data: rows }
          );
          console.log("Sync successful:", response.data);
        } catch (error) {
          console.error("Error syncing database:", error.message);
        }
      });

      dbInstance.close();
    }
  );
}

// Sync database every 3 hours
setInterval(syncDatabase, 10800000); // 3 hours in milliseconds
syncDatabase(); // Initial sync on startup

// Execute command function
const executeCommand = (command) => {
  return new Promise((resolve, reject) => {
    const macAddress = getMacAddress();

    exec(command, (error, stdout) => {
      if (error) {
        console.error(`Error executing command "${command}": ${error.message}`);
        reject(error);
      } else {
        console.log(`Output of "${command}":\n${stdout}`);
        resolve(stdout);
      }
    });
  });
};

// Create main window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html"); // Load your HTML file
}

// Handle app lifecycle events
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
