// utils.js
const os = require("os");
const fs = require("fs");
const https = require("https");

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

// Function to download an image from a URL
function downloadImage(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);

          file.on("finish", () => file.close(() => resolve()));
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

module.exports = { getMacAddress, downloadImage };
