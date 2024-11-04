const os = require("os");
const {
  getMacAddress,
  getLocation,
  formatActiveTime,
  isValidTimeFormat,
} = require("../utils/system");

class ActivityLogger {
  constructor(db) {
    this.db = db;
  }

  async logStatus() {
    const uniqueId = getMacAddress();
    const username = os.userInfo().username;
    const timestamp = new Date().toISOString();
    const date = new Date().toISOString().split("T")[0];
    const location = await getLocation();

    this.db.get(
      `SELECT * FROM system_tracking WHERE mac_address=? AND date=?`,
      [uniqueId, date],
      (err, row) => {
        if (err) {
          console.error("Error selecting from database:", err);
          return;
        }

        if (row) {
          let activeTime = row.active_time;
          if (!isValidTimeFormat(activeTime)) {
            activeTime = "00:00:00";
          }

          const activeTimeInSeconds = activeTime
            .split(":")
            .reduce((acc, time) => 60 * acc + +time, 0);
          const newActiveTimeInSeconds = activeTimeInSeconds + 60;
          const newActiveTime = formatActiveTime(newActiveTimeInSeconds);

          this.updateActivity(
            uniqueId,
            date,
            newActiveTime,
            location,
            timestamp,
            username
          );
        } else {
          const newActiveTime = formatActiveTime(60);
          this.createActivity(
            uniqueId,
            username,
            date,
            newActiveTime,
            location,
            timestamp
          );
        }
      }
    );
  }

  updateActivity(uniqueId, date, newActiveTime, location, timestamp, username) {
    this.db.run(
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
  }

  createActivity(uniqueId, username, date, newActiveTime, location, timestamp) {
    this.db.run(
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


module.exports = ActivityLogger;
