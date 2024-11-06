const { exec } = require("child_process");
const {
  getMacAddress,
  findExecutableWithDpkg,
  createDesktopShortcut,
} = require("../services/systemService");

function executeCommand(command, ws) {
  return new Promise((resolve, reject) => {
    const macAddress = getMacAddress();
    let responsePayload = [];

    if (
      command.startsWith(
        "gsettings set org.gnome.desktop.background picture-uri"
      )
    ) {
      handleWallpaperCommand(
        command,
        macAddress,
        responsePayload,
        ws,
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
        ws,
        resolve,
        reject
      );
    } else {
      handleGenericCommand(command, macAddress, responsePayload, ws, resolve);
    }
  });
}

function handleWallpaperCommand(
  command,
  macAddress,
  responsePayload,
  ws,
  resolve,
  reject
) {
  const urlMatch = command.match(/'(https?:\/\/[^']+)'/);
  if (urlMatch) {
    const wallpaperUrl = urlMatch[1];
    const localCommand = `gsettings set org.gnome.desktop.background picture-uri "${wallpaperUrl}"`;

    exec(localCommand, (error, stdout, stderr) => {
      const response = {
        type: "wallpaper",
        status: !error,
        mac_address: macAddress,
      };
      responsePayload.push(response);
      ws.send(JSON.stringify(responsePayload));
      resolve();
    });
  } else {
    reject(new Error("No valid URL in command"));
  }
}

async function handleSoftwareInstallation(
  command,
  macAddress,
  responsePayload,
  ws,
  resolve,
  reject
) {
  exec(command, async (error, stdout, stderr) => {
    if (error) {
      handleInstallationError(
        error,
        command,
        macAddress,
        responsePayload,
        ws,
        reject
      );
    } else {
      await handleSuccessfulInstallation(
        command,
        macAddress,
        responsePayload,
        ws,
        resolve
      );
    }
  });
}

function handleGenericCommand(
  command,
  macAddress,
  responsePayload,
  ws,
  resolve
) {
  exec(command, (error, stdout, stderr) => {
    responsePayload.push({
      mac: macAddress,
      success: !error,
    });
    ws.send(JSON.stringify(responsePayload));
    resolve();
  });
}

module.exports = {
  executeCommand,
};
