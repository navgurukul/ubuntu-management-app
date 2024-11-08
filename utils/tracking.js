// utils/tracking.js
const os = require("os");
const { getMacAddress, getStoredMacAddress } = require("./system");
const { getLocation } = require("./location");
const { getDatabase } = require("./database");
const {formatActiveTime}= require("../utils/system")
function isValidTimeFormat(timeString) {
  const timePattern = /^\d{2}:\d{2}:\d{2}$/;
  return timePattern.test(timeString);
}

async function logStatus() {
  // Try to get stored MAC first, then fall back to current MAC
  const storedMac = getStoredMacAddress();
  const uniqueId = storedMac || getMacAddress();

  const username = os.userInfo().username;
  const timestamp = new Date().toISOString();
  const date = new Date().toISOString().split("T")[0];
  const location = await getLocation();
  const db = getDatabase();

  if (!db) {
    console.error("Database not initialized");
    return;
  }

  db.get(
    `SELECT * FROM system_tracking WHERE mac_address=? AND date=?`,
    [uniqueId, date],
    (err, row) => {
      if (err) {
        console.error("Error selecting from database:", err);
        return;
      }

      if (row) {
        let activeTime = row.active_time;
        console.log("Current active time in DB:", activeTime);

        if (!isValidTimeFormat(activeTime)) {
          console.error("Invalid active time format detected:", activeTime);
          activeTime = "00:00:00";
        }

        const activeTimeInSeconds = activeTime
          .split(":")
          .reduce((acc, time) => 60 * acc + +time, 0);
        const newActiveTimeInSeconds = activeTimeInSeconds + 60;
        const newActiveTime = formatActiveTime(newActiveTimeInSeconds);

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
        const newActiveTime = formatActiveTime(60);

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

module.exports = { logStatus };
