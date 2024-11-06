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

const userDataPath = app.getPath("userData");
const channelFilePath = path.join(userDataPath, "channel.json");
const configFilePath = path.join(userDataPath, "config.json");
let commandReceived 
const dns = require("dns");
console.log("Starting the app===================...", channelFilePath);
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
let rws;

function ensureUserDataFiles() {
  try {
    // Create userData directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Ensure channel.json exists
    if (!fs.existsSync(channelFilePath)) {
      fs.writeFileSync(
        channelFilePath,
        JSON.stringify({ currentChannel: [] }, null, 2),
        "utf8"
      );
      console.log("Created channel.json in userData directory");
    }

    // Ensure config.json exists
    if (!fs.existsSync(configFilePath)) {
      fs.writeFileSync(
        configFilePath,
        JSON.stringify({ channelSubmitted: false }, null, 2),
        "utf8"
      );
      console.log("Created config.json in userData directory");
    }
  } catch (error) {
    console.error("Error ensuring user data files:", error);
  }
}
function checkNetworkAndReconnect(channelNames) {
  setInterval(async () => {
    if (await isOnline()) {
      if (!rws || rws.readyState === WebSocket.CLOSED) {
         initializeWebSocket(channelNames);
        console.log("Network is online. ");
      }
    } else {
      console.log("Network is offline. Waiting to reconnect WebSocket...");
    }
  }, 5000); // Check every 5 seconds
}
// Database path for tracking

const dbPath = path.join(app.getPath("userData"), "system_tracking.db");


function readConfig() {
  try {
    ensureUserDataFiles();
    const data = fs.readFileSync(configFilePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading config file:", error);
    return { channelSubmitted: false };
  }
}

function writeConfig(config) {
  try {
    ensureUserDataFiles();
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), "utf8");
    console.log("Config written successfully");
  } catch (error) {
    console.error("Error writing to config file:", error);
  }
}

// Configure logging
log.transports.file.level = "debug";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Disable sandbox at runtime
app.commandLine.appendSwitch("no-sandbox");
// Disable GPU acceleration if you experience issues
app.commandLine.appendSwitch("disable-gpu");

// Show a dialog when an update is available
autoUpdater.on("update_available", () => {
  log.info("Update available.");
});

// Download and install the update
autoUpdater.on("update_downloaded", () => {
  log.info("Update downloaded. Installing...");
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

function getCurrentChannel() {
  try {
    ensureUserDataFiles();
    const data = fs.readFileSync(channelFilePath, "utf8");
    const parsedData = JSON.parse(data);
    return parsedData.currentChannel || [];
  } catch (error) {
    console.error("Error reading channel data:", error);
    return [];
  }
}


function ensureChannelFileExists() {
  if (!fs.existsSync(channelFilePath)) {
    fs.writeFileSync(
      channelFilePath,
      JSON.stringify({ currentChannel: [] }, null, 2),
      "utf8"
    );
  }
}

// Function to save the channel name to JSON file
function saveChannelName(channelName) {
  try {
    ensureUserDataFiles();
    const data = { currentChannel: [channelName] };
    fs.writeFileSync(channelFilePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`Channel name saved to userData: ${channelName}`);
  } catch (error) {
    console.error("Error saving channel name:", error);
  }
}
function findExecutableWithDpkg(softwareName) {
  return new Promise((resolve, reject) => {
    exec(`dpkg -L ${softwareName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `dpkg command error for ${softwareName}: ${error.message}`
        );
        return resolve(null);
      }

      // Find executable paths in /usr/bin within dpkg output
      const executablePath = stdout
        .split("\n")
        .find(
          (line) => line.startsWith("/usr/bin/") && fs.existsSync(line.trim())
        );
      resolve(executablePath ? executablePath.trim() : null);
    });
  });
}

function verifyExecutablePath(execPath, retries = 5, delay = 1000) {
  return new Promise((resolve, reject) => {
    const check = (attempt) => {
      if (fs.existsSync(execPath)) {
        resolve(true);
      } else if (attempt < retries) {
        setTimeout(() => check(attempt + 1), delay);
      } else {
        reject(
          new Error(
            `Executable not found at ${execPath} after ${retries} attempts.`
          )
        );
      }
    };
    check(0);
  });
}


// Create main window

let mainWindow = null; // Store window reference globally

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
    show: false, // Start hidden by default
    skipTaskbar: true, // Hide from taskbar
  });

  mainWindow.loadFile("index.html");

  // Read config before deciding to show window
  const config = readConfig();

  if (!config.channelSubmitted) {
    // Only show window if channel hasn't been submitted
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
      mainWindow.webContents.send("prompt-channel-name");
    });
  } else {
    // If channel is already submitted, initialize WebSocket without showing window
    const channelNames = getCurrentChannel();
    console.log(`Loaded Channel Names: ${channelNames.join(", ")}`);
    initializeWebSocket(channelNames);
    checkNetworkAndReconnect(channelNames);
  }

  autoUpdater.checkForUpdatesAndNotify();
}

// Function to reset the channel (delete channel.json) and restart the app
// Function to reset the channel (clear channel.json)
// Update the reset channel function
function resetChannel() {
  try {
    fs.writeFileSync(channelFilePath, JSON.stringify({ currentChannel: [] }, null, 2), "utf8");
    console.log("Channel reset successful. 'channel.json' cleared.");

    // Reset the config
    const config = readConfig();
    config.channelSubmitted = false;
    writeConfig(config);

    // Show the window before restarting
    if (mainWindow) {
      mainWindow.show();
    }

    // Relaunch the app
    app.relaunch();
    app.exit();
  } catch (error) {
    console.error("Error resetting channel:", error);
  }
}

// resetChannel()
// Initialize WebSocket connection
function initializeWebSocket(channelNames) {
  // WebSocket connection
  rws = new WebSocket("wss://rms.thesama.in");

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

    try {
      let tempCommands =  commandReceived
      const dataObj = JSON.parse(data);
      const commands = dataObj.commands;

      commandReceived = commands

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
      if (tempCommands !== commandReceived) {
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
      }
    } catch (error) {
      console.error("Error parsing JSON:", error.message);
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

        if (urlMatch) {
          const wallpaperUrl = urlMatch[1];
          const localCommand = `gsettings set org.gnome.desktop.background picture-uri "${wallpaperUrl}"`;

          // Execute the command to set the wallpaper directly from the URL
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
                `Wallpaper set successfully from URL: ${wallpaperUrl}`
              );
            }
            responsePayload.push(wallpaperResponse);
            console.log("Response Payload (Wallpaper):", wallpaperResponse); // Log the response payload
            // Send all payloads to server once at the end
            rws.send(JSON.stringify(responsePayload));
            console.log("Sending to server:", JSON.stringify(responsePayload)); // Log the payload being sent
            resolve();
          });
        }
        
        else {
          console.error("No valid URL found in wallpaper command.");
          responsePayload.push({
            type: "wallpaper",
            status: false,
            mac_address: macAddress,
          });
          console.log("Response Payload (Invalid URL Error):", responsePayload); // Log the response payload
          // Send all payloads to server once at the end
          rws.send(JSON.stringify(responsePayload));
          console.log("Sending to server:", JSON.stringify(responsePayload)); // Log the payload being sent
          reject(new Error("No valid URL in command"));
        }
      } else if (
        command.startsWith("sudo apt install") ||
        command.startsWith("apt install")
      ) {
        // Handle software installation and create shortcuts
       exec(command, async (error, stdout, stderr) => {
         if (error) {
           console.error(
             `Error executing command "${command}": ${error.message}`
           );
           responsePayload.push({
             type: "software",
             installed_software: command.split(" ")[3] || "unknown",
             status: false,
             mac_address: macAddress,
           });
           console.log(
             "Response Payload (Software Installation Error):",
             responsePayload
           );
           rws.send(JSON.stringify(responsePayload));
           console.log("Sending to server:", JSON.stringify(responsePayload));
           reject(error);
         } else {
           console.log(`Output of "${command}":\n${stdout}`);
           const commandParts = command.split(" ");
           const installIndex = commandParts.indexOf("install");
           if (installIndex !== -1) {
             const softwareNames = commandParts
               .slice(installIndex + 1)
               .filter((part) => !part.startsWith("-"));

             // Use a for..of loop to handle async verification
             for (const software of softwareNames) {
               const softwareTrimmed = software.trim();
              const execPath = await findExecutableWithDpkg(softwareTrimmed);

               if (execPath) {
                 try {
                   await verifyExecutablePath(execPath); // Ensure the executable is ready
                   responsePayload.push({
                     type: "software",
                     installed_software: softwareTrimmed,
                     status: true,
                     mac_address: macAddress,
                   });
                   console.log(
                     "Response Payload (Software Installed):",
                     responsePayload
                   );
                   createDesktopShortcut(execPath, softwareTrimmed); // Use dynamic execPath
                 } catch (verifyError) {
                   console.error(
                     `Failed to verify executable for ${softwareTrimmed}: ${verifyError.message}`
                   );
                   responsePayload.push({
                     type: "software",
                     installed_software: softwareTrimmed,
                     status: false,
                     mac_address: macAddress,
                   });
                 }
               } else {
                 console.error(
                   `No executable found in /usr/bin for ${softwareTrimmed}`
                 );
                 responsePayload.push({
                   type: "software",
                   installed_software: softwareTrimmed,
                   status: false,
                   mac_address: macAddress,
                 });
               }
             }
           }
           rws.send(JSON.stringify(responsePayload));
           console.log("Sending to server:", JSON.stringify(responsePayload));
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
          responsePayload.push(otherCommandResponse);
          console.log(
            "Response Payload (Other Command):",
            otherCommandResponse
          );
          rws.send(JSON.stringify(responsePayload));
          console.log("Sending to server:", JSON.stringify(responsePayload)); // Log the payload being sent
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


function createDesktopShortcut(execPath, softwareName) {
  const desktopPath = path.join(
    os.homedir(),
    "Desktop",
    `${softwareName}.desktop`
  );

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
X-GNOME-Autostart-enabled=true
X-GIO-NoFuse=true
StartupNotify=false`;

  fs.writeFile(desktopPath, shortcutContent, (err) => {
    if (err) {
      console.error(
        `Error creating shortcut for ${softwareName}: ${err.message}`
      );
    } else {
      console.log(`Shortcut for ${softwareName} created successfully.`);
            exec(`chmod +x "${desktopPath}"`, (chmodError) => {
              if (chmodError) {
                console.error(
                  `Error setting executable permission for ${desktopPath}: ${chmodError.message}`
                );
              } else {
                console.log(
                  `Executable permission set for ${desktopPath}. Shortcut is ready to launch.`
                );
              }
            });
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
  if (await isOnline()) {
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
  } else {
    console.log("Laptop is offline. Skipping database sync.");
  }
}

// Sync database every 3 hours
setInterval(syncDatabase, 600000); // 3 hours in milliseconds
syncDatabase(); // Initial sync on startup

// Handle app lifecycle events
app.whenReady().then(() => {
  ensureUserDataFiles();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // Only create a new window if we don't have one and config.channelSubmitted is false
  if (BrowserWindow.getAllWindows().length === 0) {
    const config = readConfig();
    if (!config.channelSubmitted) {
      createWindow();
    }
  }
});
// Handle the event from renderer process to save the channel name
// Update the IPC handler for saving channel name
ipcMain.on("save-channel-name", (event, channelName) => {
  saveChannelName(channelName);
  
  // Update config
  const config = readConfig();
  config.channelSubmitted = true;
  writeConfig(config);

  // Initialize WebSocket
  initializeWebSocket([channelName]);
  checkNetworkAndReconnect([channelName]);

  // Hide the window instead of just trying to close it
  if (mainWindow) {
    mainWindow.hide();
  }
});


// Modified reset channel function to work with userData directory
function resetChannel() {
  try {
    ensureUserDataFiles();
    fs.writeFileSync(
      channelFilePath,
      JSON.stringify({ currentChannel: [] }, null, 2),
      "utf8"
    );
    
    const config = readConfig();
    config.channelSubmitted = false;
    writeConfig(config);
    
    console.log("Channel reset successful in userData directory");

    if (mainWindow) {
      mainWindow.show();
    }

    app.relaunch();
    app.exit();
  } catch (error) {
    console.error("Error resetting channel:", error);
  }
}
// resetChannel()
ipcMain.on("reset-channel", () => {
  resetChannel();
});

// Handle the event to check if channel.json exists
ipcMain.on("check-channel-file", (event) => {
  const exists = fs.existsSync(channelFilePath);
  event.sender.send("channel-file-status", exists);
});

async function getLocation() {
  if (await isOnline()) {
    try {
      const response = await axios.get("http://ip-api.com/json/");
      const { city, regionName, country } = response.data;
      return `${city}, ${regionName}, ${country}`;
    } catch (error) {
      console.error("Error fetching location:", error.message);
      return "Unknown Location";
    }
  } else {
    console.log("Laptop is offline. Unable to fetch location.");
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
  return "Unknown MAC";
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
        const activeTimeInSeconds = activeTime
          .split(":")
          .reduce((acc, time) => 60 * acc + +time, 0);
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
