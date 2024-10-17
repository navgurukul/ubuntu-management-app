const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const WebSocket = require("ws");
const { exec } = require("child_process");
const sqlite3 = require("sqlite3").verbose();
const { getMacAddress, downloadImage } = require("./utils"); // Import utility functions

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

app.whenReady().then(createWindow);

// Handle IPC messages from renderer for command execution
ipcMain.on("execute-command", (event, command) => {
  executeCommand(command)
    .then((result) => {
      event.reply("command-result", { success: true, result });
    })
    .catch((error) => {
      event.reply("command-result", { success: false, error: error.message });
    });
});

// Function to execute commands received from renderer
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const macAddress = getMacAddress(); // Get the MAC address

    console.log(`Executing command: ${command}`);

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
                reject(error);
              } else {
                console.log(
                  `Wallpaper set successfully using: ${wallpaperPath}`
                );
                resolve();
              }
            });
          })
          .catch(reject);
      } else {
        reject(new Error("No valid URL found in wallpaper command."));
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
          reject(error);
        } else {
          console.log(`Output of "${command}":\n${stdout}`);
          resolve(stdout);
          // Additional logic to create shortcuts can be added here
        }
      });
    } else {
      exec(command, (error, stdout) => {
        if (error) {
          console.error(
            `Error executing command "${command}": ${error.message}`
          );
          reject(error);
        } else {
          console.log(`Output of "${command}":\n${stdout}`);
          resolve(stdout);
        }
      });
    }
  });
}

// Clean up when all windows are closed.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
