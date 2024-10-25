const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const path = require("path");
const WebSocket = require("ws");
const { exec } = require("child_process");
const os = require("os");
const fs = require("fs");
const https = require("https");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");

// Path to the JSON file where channel name is stored
const channelFilePath = path.join(app.getPath("userData"), "channel.json");

// Database path for tracking
const dbPath = path.join(__dirname, "system_tracking.db");
const rws = new WebSocket("wss://rms.thesama.in");

// Configure logging
log.transports.file.level = "debug";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;



// Show a dialog when an update is available
autoUpdater.on('update_available', () => {
  log.info('Update available.');
});

// Download and install the update
autoUpdater.on('update_downloaded', () => {
  log.info('Update downloaded. Installing...');
  autoUpdater.quitAndInstall();
});


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

// Function to save the channel name to JSON file
function saveChannelName(channelName) {
  const data = { currentChannel: [channelName] };
  fs.writeFileSync(channelFilePath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Channel name saved: ${channelName}`);
}

// Create main window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false, // Start hidden
    skipTaskbar: true, // Hide from taskbar
  });

  win.loadFile("index.html");

  // Show window only if channel.json doesn't exist
  if (!fs.existsSync(channelFilePath)) {
    win.once('ready-to-show', () => {
      win.show();
    });
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("prompt-channel-name");
    });
  } else {
    // Load channels and connect WebSocket if channel is already set
    let channelNames = getCurrentChannel();
    console.log(`Loaded Channel Names: ${channelNames.join(", ")}`);
    initializeWebSocket(channelNames);
  }

  autoUpdater.checkForUpdatesAndNotify();
}

// Function to reset the channel (delete channel.json) and restart the app
function resetChannel() {
  fs.unlink(channelFilePath, (err) => {
    if (!err) {
      console.log("Channel reset successful. 'channel.json' deleted.");
      app.relaunch(); // Relaunch the app after reset
      app.exit(); // Close current instance
    }
  });
}


// Initialize WebSocket connection
function initializeWebSocket(channelNames) {
  // WebSocket connection
  const rws = new WebSocket("wss://rms.thesama.in");

  console.log(`Connecting to WebSocket server with channels: ${channelNames}`);

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

  const executeCommand = (command) => {
    return new Promise((resolve, reject) => {
      const macAddress = getMacAddress(); // Get the MAC address
      let responsePayload = []; // Initialize the response payload as an array
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
          // Download the new wallpaper
          downloadImage(wallpaperUrl, wallpaperPath)
            .then(() => {
              const localCommand = `gsettings set org.gnome.desktop.background picture-uri "file://${wallpaperPath}"`;
              // Execute the command to set the wallpaper
              exec(localCommand, (error, stdout, stderr) => {
                const wallpaperResponse = {
                  type: "wallpaper",
                  status: !error,
                  mac_address: macAddress,
                };
                if (error) {
                  console.error(
                    `Error executing command "${localCommand}": ${error.message}`
                  );
                  wallpaperResponse.status = false;
                } else {
                  console.log(
                    `Wallpaper set successfully using: ${wallpaperPath}`
                  );
                }
                responsePayload.push(wallpaperResponse);
                console.log('Response Payload (Wallpaper):', wallpaperResponse); // Log the response payload
                // Send all payloads to server once at the end
                rws.send(JSON.stringify(responsePayload));
                console.log('Sending to server:', JSON.stringify(responsePayload)); // Log the payload being sent
                resolve();
              });
            })
            .catch((error) => {
              console.error(`Error downloading wallpaper: ${error.message}`);
              responsePayload.push({
                type: "wallpaper",
                status: false,
                mac_address: macAddress,
              });
              console.log('Response Payload (Wallpaper Download Error):', responsePayload); // Log the response payload
              // Send all payloads to server once at the end
              rws.send(JSON.stringify(responsePayload));
              console.log('Sending to server:', JSON.stringify(responsePayload)); // Log the payload being sent
              reject(error);
            });
        } else {
          console.error("No valid URL found in wallpaper command.");
          responsePayload.push({
            type: "wallpaper",
            status: false,
            mac_address: macAddress,
          });
          console.log('Response Payload (Invalid URL Error):', responsePayload); // Log the response payload
          // Send all payloads to server once at the end
          rws.send(JSON.stringify(responsePayload));
          console.log('Sending to server:', JSON.stringify(responsePayload)); // Log the payload being sent
          reject(new Error("No valid URL in command"));
        }
      } else if (
        command.startsWith("sudo apt install") ||
        command.startsWith("apt install")
      ) {
        // Handle software installation and create shortcuts
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(
              `Error executing command "${command}": ${error.message}`
            );
            responsePayload.push({
              type: "software",
              installed_software: command.split(" ")[3] || 'unknown',
              status: false,
              mac_address: macAddress,
            });
            console.log('Response Payload (Software Installation Error):', responsePayload); // Log the response payload
            // Send all payloads to server once at the end
            rws.send(JSON.stringify(responsePayload));
            console.log('Sending to server:', JSON.stringify(responsePayload)); // Log the payload being sent
            reject(error);
          } else {
            console.log(`Output of "${command}":\n${stdout}`);
            // Extract the software names correctly
            const commandParts = command.split(" ");
            const installIndex = commandParts.indexOf("install");
            if (installIndex !== -1) {
              // Get all parts after the install keyword
              const softwareNames = commandParts.slice(installIndex + 1).filter(part => !part.startsWith("-"));
              // Create a response payload for each installed software
              softwareNames.forEach(software => {
                responsePayload.push({
                  type: "software",
                  installed_software: software.trim(), // This will now show the actual software name
                  status: true,
                  mac_address: macAddress,
                });
                console.log('Response Payload (Software Installed):', responsePayload); // Log the response payload
                // Create desktop shortcuts
                createDesktopShortcut(software.trim());
              });
            }
            // Send all payloads to server once at the end
            rws.send(JSON.stringify(responsePayload));
            console.log('Sending to server:', JSON.stringify(responsePayload)); // Log the payload being sent
            resolve();
          }
        });
      } else {
        // Execute other commands as usual
        exec(command, (error, stdout, stderr) => {
          const otherCommandResponse = { mac: macAddress, success: !error };
          if (error) {
            console.error(
              `Error executing command "${command}": ${error.message}`
            );
            otherCommandResponse.success = false;
          } else {
            console.log(`Output of "${command}":\n${stdout}`);
          }
          // Add to response payload
          responsePayload.push(otherCommandResponse);
          console.log('Response Payload (Other Command):', otherCommandResponse); // Log the response payload
          // Send all payloads to server once at the end
          rws.send(JSON.stringify(responsePayload));
          console.log('Sending to server:', JSON.stringify(responsePayload)); // Log the payload being sent
          resolve();
        });
      }
    });
  };
}

// Function to download image
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
        fs.unlink(destination); // Delete on error
        reject(error);
      });
  });
}

// Function to create desktop shortcut for installed software
function createDesktopShortcut(softwareName) {
  const desktopPath = path.join(
    os.homedir(),
    "Desktop",
    `${softwareName}.desktop`
  );

  const execPath = `/usr/bin/${softwareName}`;

  const defaultIconPath =
    "/usr/share/icons/hicolor/48x48/apps/utilities-terminal.png";

  const softwareIconPath = `/usr/share/icons/hicolor/48x48/apps/${softwareName}.png`;

  let iconPath = fs.existsSync(softwareIconPath)
    ? softwareIconPath
    : defaultIconPath;

  const shortcutContent = `[Desktop Entry]
   Type=Application
   Name=${softwareName}
   Exec=${execPath}
   Icon=${iconPath}
   Terminal=false
   Categories=Utility;
   X-GNOME-Autostart-enabled=true`;

  fs.writeFile(desktopPath, shortcutContent, (err) => {
    if (err) {
      console.error(
        `Error creating shortcut for ${softwareName}: ${err.message}`
      );
    } else {
      console.log(`Shortcut for ${softwareName} created successfully.`);
    }
  });
}

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
          console.error("the data is"+JSON.parse(rows));
          console.error("Error syncing database:", error.message);
        }
      });

      dbInstance.close();
    }
  );
}

// Sync database every 3 hours
setInterval(syncDatabase, 10000); // 3 hours in milliseconds
syncDatabase(); // Initial sync on startup

// Handle app lifecycle events
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  // if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle the event from renderer process to save the channel name
ipcMain.on("save-channel-name", (event, channelName) => {
  saveChannelName(channelName);
  initializeWebSocket([channelName]); // Start WebSocket after saving channel
});

// Function to reset the channel (delete channel.json)
function resetChannel() {
  fs.unlink(channelFilePath, (err) => {
    if (err) {
      console.error("Error deleting channel.json:", err);
    } else {
      console.log("Channel reset successful. 'channel.json' deleted.");
    }
  });
}

resetChannel()
// Handle IPC from renderer process for resetting channel
ipcMain.on("reset-channel", () => {
  resetChannel();
});

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

function formatActiveTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isValidTimeFormat(timeString) {
  // Validate time format HH:MM:SS
  const timePattern = /^\d{2}:\d{2}:\d{2}$/;
  return timePattern.test(timeString);
}

async function logStatus() {
  const uniqueId = getMacAddress();
  const username = os.userInfo().username;
  const timestamp = new Date().toISOString();
  const date = new Date().toISOString().split("T")[0];
  const location = await getLocation();

  db.get(
      `SELECT * FROM system_tracking WHERE mac_address=? AND date=?`,
      [uniqueId, date],
      (err, row) => {
          if (err) {
              console.error("Error selecting from database:", err);
          } else if (row) {
              // If a record for today exists
              let activeTime = row.active_time;
              console.log("Current active time in DB:", activeTime);

              // Validate the format
              if (!isValidTimeFormat(activeTime)) {
                  console.error("Invalid active time format detected:", activeTime);
                  // Reset active time to 00:00:00 if the format is invalid
                  activeTime = "00:00:00";
              }

              // Convert HH:MM:SS to seconds
              const activeTimeInSeconds = activeTime.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
              const newActiveTimeInSeconds = activeTimeInSeconds + 60; // Add one minute
              const newActiveTime = formatActiveTime(newActiveTimeInSeconds);

              // Update the database with the new active time
              db.run(
                  `UPDATE system_tracking SET active_time=?, location=? WHERE mac_address=? AND date=?`,
                  [newActiveTime, location, uniqueId, date],
                  (err) => {
                      if (err) {
                          console.error("Error updating database:", err);
                      } else {
                          console.log(
                              `${timestamp} - "${uniqueId}" (${username}) active for ${newActiveTime} at ${location} on ${date}`
                          );
                      }
                  }
              );
          } else {
              const newActiveTime = formatActiveTime(60); // Set to one minute for a new record

              db.run(
                  `INSERT INTO system_tracking(mac_address, username, date, active_time, location) VALUES(?,?,?,?,?)`,
                  [uniqueId, username, date, newActiveTime, location],
                  (err) => {
                      if (err) {
                          console.error("Error inserting into database:", err);
                      } else {
                          console.log(
                              `${timestamp} - "${uniqueId}" (${username}) active for ${newActiveTime} at ${location} on ${date}`
                          );
                      }
                  }
              );
          }
      }
  );
}

logStatus();
setInterval(logStatus, 60000);


//ghp_ayeoitWUKYEnWCEqT6CJ1NQFUJIlDam0hPeKo