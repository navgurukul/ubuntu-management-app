const sqlite3 = require("sqlite3").verbose();
const { dbPath } = require("../config/paths");

let db;

function initializeDatabase() {
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("Error opening database:", err.message);
      return;
    }
    console.log("Connected to the database.");

    setupDatabase();
  });

  return db;
}

function setupDatabase() {
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON;");
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
}

function getDatabase() {
  return db;
}

module.exports = { initializeDatabase, getDatabase };
