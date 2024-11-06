const os = require('os');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function getMacAddress() {
  const networkInterfaces = os.networkInterfaces();
  for (let interfaceName in networkInterfaces) {
    const networkDetails = networkInterfaces[interfaceName];
    for (let i = 0; i < networkDetails.length; i++) {
      if (networkDetails[i].mac && networkDetails[i].mac !== "00:00:00:00:00:00") {
        return networkDetails[i].mac;
      }
    }
  }
  return "Unknown MAC";
}

function findExecutableWithDpkg(softwareName) {
  return new Promise((resolve, reject) => {
    exec(`dpkg -L ${softwareName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`dpkg command error for ${softwareName}: ${error.message}`);
        return resolve(null);
      }
      const executablePath = stdout
        .split("\n")
        .find(line => line.startsWith("/usr/bin/") && fs.existsSync(line.trim()));
      resolve(executablePath ? executablePath.trim() : null);
    });
  });
}

function createDesktopShortcut(execPath, softwareName) {
  const desktopPath = path.join(os.homedir(), "Desktop", `${softwareName}.desktop`);
  const defaultIconPath = "/usr/share/icons/hicolor/48x48/apps/utilities-terminal.png";
  const softwareIconPath = `/usr/share/icons/hicolor/48x48/apps/${softwareName}.png`;
  const iconPath = fs.existsSync(softwareIconPath) ? softwareIconPath : defaultIconPath;

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
      console.error(`Error creating shortcut for ${softwareName}: ${err.message}`);
    } else {
      exec(`chmod +x "${desktopPath}"`, (chmodError) => {
        if (chmodError) {
          console.error(`Error setting executable permission for ${desktopPath}: ${chmodError.message}`);
        } else {
          console.log(`Executable permission set for ${desktopPath}. Shortcut is ready to launch.`);
        }
      });
    }
  });
}

module.exports = {
  getMacAddress,
  findExecutableWithDpkg,
  createDesktopShortcut
};
