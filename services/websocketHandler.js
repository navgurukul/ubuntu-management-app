const WebSocket = require("ws");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const https = require("https");
const os = require("os");
const { getMacAddress } = require("../utils/system");
const { WEBSOCKET_URL } = require("../config/constants");

class WebSocketHandler {
  constructor() {
    this.ws = null;
    this.channelNames = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 1000;
    this.baseReconnectDelay = 5000;
    this.maxReconnectDelay = 300000;
    this.pingInterval = null;
    this.pongTimeout = null;
  }

  initialize(channelNames) {
    this.channelNames = channelNames;
    this.connect();
    this.setupInternetConnectionMonitoring();
  }

  connect() {
    try {
      console.log(
        `Attempting to connect to WebSocket server with channels: ${this.channelNames}`
      );

      this.ws = new WebSocket(WEBSOCKET_URL);

      this.ws.on("open", () => this.handleOpen());
      this.ws.on("message", (data) => this.handleMessage(data));
      this.ws.on("close", (event) => this.handleClose(event));
      this.ws.on("error", (error) => this.handleError(error));
      this.ws.on("pong", () => this.handlePong());
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      this.scheduleReconnect();
    }
  }

  handleOpen() {
    console.log("[Client] Connected to WebSocket server.");
    this.isConnected = true;
    this.reconnectAttempts = 0;

    const message = JSON.stringify({
      type: "subscribe",
      channels: this.channelNames,
    });
    console.log("Sending subscription message:", message);
    this.ws.send(message);

    this.setupPingPong();
  }

  async handleMessage(data) {
    const dataObj = JSON.parse(data);
    const commands = dataObj.commands;
    const macAddress = getMacAddress();

    if (!Array.isArray(commands)) {
      console.error("Received commands is not an array:", commands);
      this.sendResponse({
        success: false,
        mac: macAddress,
        error: "Commands is not an array",
      });
      return;
    }

    try {
      for (const command of commands) {
        await this.executeCommand(command);
      }

      this.sendResponse({
        success: true,
        mac: macAddress,
      });
    } catch (error) {
      console.error("Error executing commands:", error);
      this.sendResponse({
        success: false,
        mac: macAddress,
        error: error.message,
      });
    }
  }

  handleClose(event) {
    console.log(
      `[Client] Connection closed. Code: ${event.code}, Reason: ${event.reason}`
    );
    this.isConnected = false;
    this.clearPingPong();
    this.scheduleReconnect();
  }

  handleError(error) {
    console.error("[Client] WebSocket error:", error.message);
    this.isConnected = false;
    this.clearPingPong();
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(
        "Max reconnection attempts reached. Stopping reconnection attempts."
      );
      return;
    }

    const delay = Math.min(
      this.baseReconnectDelay *
        Math.pow(1.5, this.reconnectAttempts) *
        (1 + Math.random() * 0.1),
      this.maxReconnectDelay
    );

    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${
        delay / 1000
      } seconds`
    );

    setTimeout(() => {
      if (!this.isConnected) {
        this.reconnectAttempts++;
        this.connect();
      }
    }, delay);
  }

  setupInternetConnectionMonitoring() {
    setInterval(() => {
      this.checkInternetConnection();
    }, 30000);
  }

  async checkInternetConnection() {
    try {
      const response = await fetch("https://rms.thesama.in/ping", {
        method: "HEAD",
        timeout: 5000,
      });

      if (response.ok && !this.isConnected) {
        console.log("Internet connection restored. Attempting to reconnect...");
        this.connect();
      }
    } catch (error) {
      console.log("Internet connection check failed:", error.message);
      if (this.isConnected) {
        this.ws?.terminate();
        this.isConnected = false;
      }
    }
  }

  setupPingPong() {
    this.clearPingPong();

    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();

        this.pongTimeout = setTimeout(() => {
          console.log("Pong timeout - connection appears to be dead");
          this.ws.terminate();
        }, 5000);
      }
    }, 30000);
  }

  handlePong() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  clearPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  sendResponse(response) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(response));
    } else {
      console.error("Cannot send response - WebSocket is not connected");
    }
  }

  async downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download image: ${response.statusCode}`)
            );
            return;
          }

          const fileStream = fs.createWriteStream(filepath);
          response.pipe(fileStream);

          fileStream.on("finish", () => {
            fileStream.close();
            resolve();
          });

          fileStream.on("error", (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
          });
        })
        .on("error", (err) => {
          fs.unlink(filepath, () => {});
          reject(err);
        });
    });
  }

  async createDesktopShortcut(softwareName) {
    try {
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

      await fs.promises.writeFile(desktopPath, shortcutContent);
      console.log(`Shortcut for ${softwareName} created successfully.`);

      // Make the shortcut executable
      await fs.promises.chmod(desktopPath, "755");
    } catch (err) {
      console.error(`Error creating shortcut for ${softwareName}:`, err);
      throw err;
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const macAddress = getMacAddress();
      let responsePayload = [];
      console.log(`Executing command: ${command}`);

      if (
        command.startsWith(
          "gsettings set org.gnome.desktop.background picture-uri"
        )
      ) {
        const urlMatch = command.match(/'(https?:\/\/[^']+)'/);
        const permanentDirectory = path.join(process.env.HOME, "wallpapers");

        if (!fs.existsSync(permanentDirectory)) {
          fs.mkdirSync(permanentDirectory, { recursive: true });
        }

        if (urlMatch) {
          const wallpaperUrl = urlMatch[1];
          const wallpaperPath = path.join(
            permanentDirectory,
            path.basename(wallpaperUrl)
          );

          this.downloadImage(wallpaperUrl, wallpaperPath)
            .then(() => {
              const localCommand = `gsettings set org.gnome.desktop.background picture-uri "file://${wallpaperPath}"`;
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
                this.sendResponse(responsePayload);
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
              this.sendResponse(responsePayload);
              reject(error);
            });
        } else {
          console.error("No valid URL found in wallpaper command.");
          responsePayload.push({
            type: "wallpaper",
            status: false,
            mac_address: macAddress,
          });
          this.sendResponse(responsePayload);
          reject(new Error("No valid URL in command"));
        }
      } else if (
        command.startsWith("sudo apt install") ||
        command.startsWith("apt install")
      ) {
        exec(command, (error, stdout, stderr) => {
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
            this.sendResponse(responsePayload);
            reject(error);
          } else {
            console.log(`Output of "${command}":\n${stdout}`);
            const commandParts = command.split(" ");
            const installIndex = commandParts.indexOf("install");
            if (installIndex !== -1) {
              const softwareNames = commandParts
                .slice(installIndex + 1)
                .filter((part) => !part.startsWith("-"));

              Promise.all(
                softwareNames.map(async (software) => {
                  const trimmedSoftware = software.trim();
                  responsePayload.push({
                    type: "software",
                    installed_software: trimmedSoftware,
                    status: true,
                    mac_address: macAddress,
                  });
                  return this.createDesktopShortcut(trimmedSoftware);
                })
              )
                .then(() => {
                  this.sendResponse(responsePayload);
                  resolve();
                })
                .catch((err) => {
                  console.error("Error creating desktop shortcuts:", err);
                  reject(err);
                });
            } else {
              resolve();
            }
          }
        });
      } else {
        exec(command, (error, stdout, stderr) => {
          const otherCommandResponse = {
            type: "command",
            status: !error,
            mac_address: macAddress,
            command: command,
            output: stdout,
          };

          if (error) {
            console.error(
              `Error executing command "${command}": ${error.message}`
            );
            otherCommandResponse.status = false;
            otherCommandResponse.error = error.message;
          } else {
            console.log(`Output of "${command}":\n${stdout}`);
          }

          responsePayload.push(otherCommandResponse);
          this.sendResponse(responsePayload);

          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      channels: this.channelNames,
    };
  }
}

module.exports = WebSocketHandler;
