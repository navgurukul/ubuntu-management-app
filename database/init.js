const sqlite3 = require("sqlite3").verbose();
const { DB_PATH } = require("../config/constants");

function initializeDatabase() {
  const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error("Error opening database:", err.message);
    } else {
      console.log("Connected to the database.");
    }
  });

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

  return db;
}

module.exports = { initializeDatabase };
