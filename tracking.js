const fs = require("fs");
const os = require("os");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const axios = require("axios");

// Database path
const dbPath = path.join(__dirname, "system_tracking.db");

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

// Function to get MAC address (unique identifier)
let lastKnownUniqueId = null;
function getUniqueId() {
  const networkInterfaces = os.networkInterfaces();
  for (const iface in networkInterfaces) {
    for (const address of networkInterfaces[iface]) {
      if (address.family === "IPv4" && !address.internal) {
        lastKnownUniqueId = address.mac;
        return address.mac;
      }
    }
  }
  return lastKnownUniqueId || "UNKNOWN_ID";
}

// Function to get location based on IP address
async function getLocation() {
  try {
    const response = await axios.get("http://ip-api.com/json/");
    const { city, regionName, country } = response.data;
    return `${city}, ${regionName}, ${country}`;
  } catch (error) {
    console.error("Error fetching location:", error.message);
    return "Unknown Location";
  }
}

// Function to log system status
async function logStatus() {
  const uniqueId = getUniqueId();
  const username = os.userInfo().username; // Get the username
  const timestamp = new Date().toISOString();
  const location = await getLocation();
  const date = new Date().toISOString().split("T")[0]; // Get the current date

  // Check if the entry for the current MAC address and today's date exists
  db.get(
    `SELECT * FROM system_tracking WHERE mac_address = ? AND date = ?`,
    [uniqueId, date],
    (err, row) => {
      if (err) {
        console.error("Error selecting from database:", err);
      } else if (row) {
        // If a record for the current date exists, increment the active time
        const updatedActiveTime = row.active_time + 1; // Increment active time by 1 minute
        db.run(
          `UPDATE system_tracking SET active_time = ?, location = ? WHERE mac_address = ? AND date = ?`,
          [updatedActiveTime, location, uniqueId, date],
          (err) => {
            if (err) {
              console.error("Error updating database:", err);
            } else {
              console.log(
                `Status updated: ${timestamp} - "${uniqueId}" (${username}) active for ${updatedActiveTime} minutes at ${location} on ${date}`
              );
            }
          }
        );
      } else {
        // If no record exists for the current date, create a new entry
        db.run(
          `INSERT INTO system_tracking (mac_address, username, date, active_time, location) VALUES (?, ?, ?, ?, ?)`,
          [uniqueId, username, date, 1, location],
          (err) => {
            if (err) {
              console.error("Error inserting into database:", err);
            } else {
              console.log(
                `Status logged: ${timestamp} - "${uniqueId}" (${username}) active for 1 minute at ${location} on ${date}`
              );
            }
          }
        );
      }
    }
  );
}

// Log the system status every 1 minute (60000 milliseconds)
logStatus();
setInterval(logStatus, 1000);
