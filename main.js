const { app, BrowserWindow, ipcMain } = require("electron");
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
    return parsedData.currentChannel || []; // Return an empty array if no channels exist
  } catch (error) {
    console.error("Error reading channel data:", error);
    return [];
  }
}

let channelNames = getCurrentChannel(); // Expecting an array of channels
console.log(`Initial Channel Names loaded: ${channelNames.join(", ")}`);

const rws = new WebSocket("wss://rms.thesama.in");

rws.on("open", () => {
  console.log("[Client] Connected to WebSocket server.");

  // Prepare the subscription message
  const message = JSON.stringify({
    type: "subscribe",
    channels: channelNames,
  });

  console.log("Sending message to server:", message);
  rws.send(message); // Send subscription message on connection open
});

rws.on("message", async (data) => {
  const dataObj = JSON.parse(data);
  const commands = dataObj.commands;
  console.log(`[Client] Command received from server: ${typeof commands}`);
  const macAddress = getMacAddress(); // Get the MAC address

  if (!Array.isArray(commands)) {
    console.error("Received commands is not an array:", commands);

    // Send an error message back to the server
    rws.send(
      JSON.stringify({
        success: false,
        mac: macAddress,
        error: "Commands is not an array",
      })
    );
    return; // Exit early if commands is not an array
  }

  try {
    for (const command of commands) {
      await executeCommand(command);
    }

    console.log("All commands executed. Sending results to the server.");
    rws.send(
      JSON.stringify({
        success: true,
        mac: macAddress,
      })
    );
  } catch (error) {
    console.error("An error occurred while executing commands:", error);

    rws.send(
      JSON.stringify({
        success: false,
        mac: macAddress,
      })
    );
  }
});

rws.on("close", (event) => {
  console.log("[Client] Connection closed.");
  console.log(`Close code: ${event.code}, reason: ${event.reason}`);
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
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return console.error("Error opening database:", err.message);
    }

    db.all(`SELECT * FROM system_tracking`, async (err, rows) => {
      if (err) {
        console.error("Error reading from database:", err.message);
      } else {
        try {
          const response = await axios.post(
            "https://ms.thesama.in/database-sync",
            {
              data: rows, // Send the extracted data to the server
            }
          );
          console.log("Sync successful:", response.data);
        } catch (error) {
          console.error("Error syncing database:", error.message);
        }
      }
    });

    db.close();
  });
}

// Sync database every 3 hours
setInterval(syncDatabase, 10000); // 3 hours in milliseconds

// Call syncDatabase immediately on startup
syncDatabase();

// Execute command function
const executeCommand = (command) => {
  return new Promise((resolve, reject) => {
    const macAddress = getMacAddress(); // Get the MAC address

    console.log(`Executing command: ${command}`);

    // Check if the command is to set a wallpaper
    if (
      command.startsWith(
        "gsettings set org.gnome.desktop.background picture-uri"
      )
    ) {
      const urlMatch = command.match(/'(https?:\/\/[^']+)'/);
      const permanentDirectory = path.join(process.env.HOME, "wallpapers");

      // Ensure the permanent directory exists
      if (!fs.existsSync(permanentDirectory)) {
        fs.mkdirSync(permanentDirectory, { recursive: true });
      }

      if (urlMatch) {
        const wallpaperUrl = urlMatch[1];
        const wallpaperPath = path.join(
          permanentDirectory,
          path.basename(wallpaperUrl)
        );

        downloadImage(wallpaperUrl, wallpaperPath)
          .then(() => {
            const localCommand = `gsettings set org.gnome.desktop.background picture-uri "file://${wallpaperPath}"`;
            exec(localCommand, (error) => {
              if (error) {
                console.error(
                  `Error executing command "${localCommand}": ${error.message}`
                );
                rws.send(JSON.stringify({ mac: macAddress, success: false }));
                reject(error);
              } else {
                console.log(
                  `Wallpaper set successfully using: ${wallpaperPath}`
                );
                rws.send(JSON.stringify({ mac: macAddress, success: true }));
                resolve();
              }
            });
          })
          .catch((error) => {
            console.error(`Error downloading wallpaper: ${error.message}`);
            rws.send(JSON.stringify({ mac: macAddress, success: false }));
            reject(error);
          });
      } else {
        console.error("No valid URL found in wallpaper command.");
        rws.send(
          JSON.stringify({
            mac: macAddress,
            success: false,
            error: "No valid URL in command",
          })
        );
        reject(new Error("No valid URL in command"));
      }
    } else if (
      command.startsWith("sudo apt install") ||
      command.startsWith("apt install")
    ) {
      exec(command, (error, stdout) => {
        if (error) {
          console.error(
            `Error executing command "${command}": ${error.message}`
          );
          rws.send(JSON.stringify({ mac: macAddress, success: false }));
          reject(error);
        } else {
          console.log(`Output of "${command}":\n${stdout}`);
          rws.send(JSON.stringify({ mac: macAddress, success: true }));
          resolve();
        }
      });
    } else {
      exec(command, (error, stdout) => {
        if (error) {
          console.error(
            `Error executing command "${command}": ${error.message}`
          );
          rws.send(JSON.stringify({ mac: macAddress, success: false }));
          reject(error);
        } else {
          console.log(`Output of "${command}":\n${stdout}`);
          rws.send(JSON.stringify({ mac: macAddress, success: true }));
          resolve();
        }
      });
    }
  });
};

// Function to download the image
function downloadImage(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);

          file.on("finish", () => {
            file.close(() => resolve());
          });
        } else {
          reject(
            new Error(
              `Failed to download image. Status code: ${response.statusCode}`
            )
          );
        }
      })
      .on("error", (error) => {
        fs.unlink(destination); // Delete the file on error
        reject(error);
      });
  });
}

// Clean up when all windows are closed.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
