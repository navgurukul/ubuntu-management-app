// const executeCommand = (command) => {
//   return new Promise((resolve, reject) => {
//     const macAddress = getMacAddress(); // Get the MAC address

//     console.log(`Executing command: ${command}`);

//     // Check if the command is to set a wallpaper
//     if (
//       command.startsWith(
//         "gsettings set org.gnome.desktop.background picture-uri"
//       )
//     ) {
//       const urlMatch = command.match(/'(https?:\/\/[^']+)'/);
//       const permanentDirectory = path.join(process.env.HOME, "wallpapers"); // Create a 'wallpapers' folder outside of laptop-management-client

//       // Ensure the permanent directory exists
//       if (!fs.existsSync(permanentDirectory)) {
//         fs.mkdirSync(permanentDirectory, { recursive: true });
//       }

//       if (urlMatch) {
//         const wallpaperUrl = urlMatch[1];
//         const wallpaperPath = path.join(
//           permanentDirectory, // Save to the 'wallpapers' folder outside of your project
//           path.basename(wallpaperUrl)
//         ); // Save to specified permanent directory

//         // Download the new wallpaper
//         downloadImage(wallpaperUrl, wallpaperPath)
//           .then(() => {
//             // Update command to use the local file
//             const localCommand = `gsettings set org.gnome.desktop.background picture-uri "file://${wallpaperPath}"`;

//             // Execute the command to set the wallpaper
//             exec(localCommand, (error, stdout, stderr) => {
//               if (error) {
//                 console.error(
//                   `Error executing command "${localCommand}": ${error.message}`
//                 );
//                 rws.send(JSON.stringify({ mac: macAddress, success: false }));
//                 reject(error);
//               } else {
//                 console.log(
//                   `Wallpaper set successfully using: ${wallpaperPath}`
//                 );
//                 rws.send(JSON.stringify({ mac: macAddress, success: true }));
//                 resolve();
//               }
//             });
//           })
//           .catch((error) => {
//             console.error(`Error downloading wallpaper: ${error.message}`);
//             rws.send(JSON.stringify({ mac: macAddress, success: false }));
//             reject(error);
//           });
//       } else {
//         console.error("No valid URL found in wallpaper command.");
//         rws.send(
//           JSON.stringify({
//             mac: macAddress,
//             success: false,
//             error: "No valid URL in command",
//           })
//         );
//         reject(new Error("No valid URL in command"));
//       }
//     } else if (
//       command.startsWith("sudo apt install") ||
//       command.startsWith("apt install")
//     ) {
//       // Handle software installation and create shortcuts
//       exec(command, (error, stdout, stderr) => {
//         if (error) {
//           console.error(
//             `Error executing command "${command}": ${error.message}`
//           );
//           rws.send(JSON.stringify({ mac: macAddress, success: false }));
//           reject(error);
//         } else {
//           console.log(`Output of "${command}":\n${stdout}`);
//           rws.send(JSON.stringify({ mac: macAddress, success: true }));

//           // Extract software names from the installation command
//           const commandParts = command.split(" ");
//           const installIndex = commandParts.indexOf("install");
//           if (installIndex !== -1) {
//             const softwareNames = commandParts
//               .slice(installIndex + 1)
//               .filter((part) => !part.startsWith("-"))
//               .join(" ");
//             const softwareList = softwareNames.split(" ");

//             // Create desktop shortcuts for each installed software
//             softwareList.forEach((software) => {
//               const trimmedSoftware = software.trim();
//               if (trimmedSoftware !== "curl") {
//                 createDesktopShortcut(trimmedSoftware); // Exclude curl and create shortcuts for other software
//               }
//             });
//           }

//           resolve();
//         }
//       });
//     } else {
//       // Execute other commands as usual
//       exec(command, (error, stdout, stderr) => {
//         if (error) {
//           console.error(
//             `Error executing command "${command}": ${error.message}`
//           );
//           rws.send(JSON.stringify({ mac: macAddress, success: false }));
//           reject(error);
//         } else {
//           console.log(`Output of "${command}":\n${stdout}`);
//           rws.send(JSON.stringify({ mac: macAddress, success: true }));
//           resolve();
//         }
//       });
//     }
//   });
// };