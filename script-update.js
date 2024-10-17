const { exec } = require("child_process");
const path = require("path");

const repoPath = path.join(__dirname);

function updateScript() {
    exec(`cd ${repoPath} && git fetch origin`, (fetchError) => {
        if (fetchError) {
            console.error(`Error fetching updates: ${fetchError.message}`);
            return;
        }                           

        exec(
            `cd ${repoPath} && git rev-parse @ && git rev-parse @{u}`,
            (checkError, stdout) => {
                if (checkError) {
                    console.error(`Error checking updates: ${checkError.message}`);
                    return;
                }

                const [localCommit, remoteCommit] = stdout.split("\n");
                if (localCommit !== remoteCommit) {
                    console.log("New updates found. Pulling the latest code...");

                    exec(`cd ${repoPath} && git pull origin main`, (pullError) => {
                        if (pullError) {
                            console.error(`Error pulling updates: ${pullError.message}`);
                            return;
                        }

                        console.log("Code updated. Restarting script...");
                        restartScript();
                    });
                } else {
                    console.log("Script is already up-to-date.");
                }
            }
        );
    });
}

function restartScript() {
    console.log("Restarting script...");
    process.exit();
}

updateScript();
