const sqlite3 = require("sqlite3").verbose();
const config = require("../config/config");

let db = null;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(config.dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err.message);
        reject(err);
      } else {
        console.log("Connected to the database.");
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
        resolve(db);
      }
    });
  });
}

function updateActiveTime(macAddress, username, activeTime, date, location) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE system_tracking SET active_time=?, location=? WHERE mac_address=? AND date=?`,
      [activeTime, location, macAddress, date],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function insertNewRecord(macAddress, username, activeTime, date, location) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO system_tracking(mac_address, username, date, active_time, location) VALUES(?,?,?,?,?)`,
      [macAddress, username, date, activeTime, location],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getRecord(macAddress, date) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM system_tracking WHERE mac_address=? AND date=?`,
      [macAddress, date],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function getAllRecords() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM system_tracking`, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  initializeDatabase,
  updateActiveTime,
  insertNewRecord,
  getRecord,
  getAllRecords,
};
