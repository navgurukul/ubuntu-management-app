// utils/commands.js
const { exec } = require("child_process");
const { getMacAddress } = require("./system");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

function findExecutableWithDpkg(softwareName) {
  return new Promise((resolve, reject) => {
    exec(`dpkg -L ${softwareName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `dpkg command error for ${softwareName}: ${error.message}`
        );
        return resolve(null);
      }

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

function handleWallpaperCommand(
  command,
  macAddress,
  responsePayload,
  resolve,
  reject
) {
  const urlMatch = command.match(/'(https?:\/\/[^']+)'/);

  if (urlMatch) {
    const wallpaperUrl = urlMatch[1];
    const localCommand = `gsettings set org.gnome.desktop.background picture-uri "${wallpaperUrl}"`;

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
        console.log(`Wallpaper set successfully from URL: ${wallpaperUrl}`);
      }

      responsePayload.push(wallpaperResponse);
      console.log("Response Payload (Wallpaper):", wallpaperResponse);
      global.rws.send(JSON.stringify(responsePayload));
      console.log("Sending to server:", JSON.stringify(responsePayload));
      resolve();
    });
  } else {
    console.error("No valid URL found in wallpaper command.");
    responsePayload.push({
      type: "wallpaper",
      status: false,
      mac_address: macAddress,
    });
    console.log("Response Payload (Invalid URL Error):", responsePayload);
    global.rws.send(JSON.stringify(responsePayload));
    console.log("Sending to server:", JSON.stringify(responsePayload));
    reject(new Error("No valid URL in command"));
  }
}
function handleSerialNumber(
  command,
  macAddress,
  responsePayload,
  resolve,
  reject
) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command "${command}": ${error.message}`);
      responsePayload.push({
        type: "serialNumber",
        serial: "unknown",
        status: false,
        mac_address: macAddress,
      });
    } else {
      // Parse the serial number from command output
      const serialMatch = stdout.match(/Serial Number:\s*(.+)/);
      const serialNumber = serialMatch ? serialMatch[1].trim() : "unknown";

      console.log(`System Serial Number: ${serialNumber}`);
      responsePayload.push({
        type: "serialNumber",
        serial: serialNumber,
        status: true,
        mac_address: macAddress,
      });
    }

    console.log("Response Payload (Serial Number):", responsePayload);
    global.rws.send(JSON.stringify(responsePayload));
    console.log("Sending to server:", JSON.stringify(responsePayload));
    resolve();
  });
}
function handleSoftwareInstallation(
  command,
  macAddress,
  responsePayload,
  resolve,
  reject
) {
  exec(command, async (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing command "${command}": ${error.message}`);
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
      global.rws.send(JSON.stringify(responsePayload));
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

        for (const software of softwareNames) {
          const softwareTrimmed = software.trim();
          const execPath = await findExecutableWithDpkg(softwareTrimmed);

          if (execPath) {
            try {
              await verifyExecutablePath(execPath);
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
              createDesktopShortcut(execPath, softwareTrimmed);
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
      global.rws.send(JSON.stringify(responsePayload));
      console.log("Sending to server:", JSON.stringify(responsePayload));
      resolve();
    }
  });
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    const macAddress = getMacAddress();
    let responsePayload = [];

    console.log(`Executing command: ${command}`);

    if (command == "sudo dmidecode -t system | grep Serial") {
      handleSerialNumber(command, macAddress, responsePayload, resolve, reject);
    } else if (
      command.startsWith(
        "gsettings set org.gnome.desktop.background picture-uri"
      )
    ) {
      handleWallpaperCommand(
        command,
        macAddress,
        responsePayload,
        resolve,
        reject
      );
    } else if (
      command.startsWith("sudo apt install") ||
      command.startsWith("apt install")
    ) {
      handleSoftwareInstallation(
        command,
        macAddress,
        responsePayload,
        resolve,
        reject
      );
    } else {
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
        console.log("Response Payload (Other Command):", otherCommandResponse);
        global.rws.send(JSON.stringify(responsePayload));
        console.log("Sending to server:", JSON.stringify(responsePayload));
        resolve();
      });
    }
  });
}

module.exports = { executeCommand };