// utils/database.js
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const config = require("../config/paths");
const axios = require("axios");
const { isOnline } = require("./network");

let sqlite3;
let betterSqlite3;
let db = null;
let isUsingSqlite3 = true;

async function ensureDirectories() {
  try {
    // Check for both database directory
    if (!config.databaseDir) {
      throw new Error("Database directory path is not defined");
    }

    // Create database directory if it doesn't exist
    if (!fsSync.existsSync(config.databaseDir)) {
      await fs.mkdir(config.databaseDir, {
        recursive: true,
        mode: 0o700,
      });
      console.log("Created database directory");
    } else {
      await fs.chmod(config.databaseDir, 0o700);
    }

    // Create backups directory within database directory
    const backupDir = path.join(config.databaseDir, "backups");
    if (!fsSync.existsSync(backupDir)) {
      await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
      console.log("Created backups directory");
    }

    console.log("Directories ensured with proper permissions");
  } catch (error) {
    console.error("Error ensuring directories:", error);
    throw error;
  }
}

function loadDatabaseDriver() {
  try {
    sqlite3 = require("sqlite3").verbose();
    isUsingSqlite3 = true;
    console.log("Using sqlite3 database driver");
  } catch (error) {
    try {
      betterSqlite3 = require("better-sqlite3");
      isUsingSqlite3 = false;
      console.log("Using better-sqlite3 database driver");
    } catch (secondError) {
      console.error("Failed to load any SQLite driver:", error);
      throw new Error("No SQLite driver available");
    }
  }
}

function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
}

async function createDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      config.dbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      async (err) => {
        if (err) {
          reject(err);
          return;
        }

        const createTableSQL = `
                    CREATE TABLE IF NOT EXISTS system_tracking (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        mac_address VARCHAR(17) NOT NULL,
                        username TEXT NOT NULL,
                        active_time TEXT NOT NULL,
                        date DATE NOT NULL,
                        location TEXT,
                        synced BOOLEAN DEFAULT 0,
                        sync_time TIMESTAMP,
                        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE INDEX IF NOT EXISTS idx_system_tracking_date ON system_tracking(date);
                    CREATE INDEX IF NOT EXISTS idx_system_tracking_mac ON system_tracking(mac_address);
                    CREATE INDEX IF NOT EXISTS idx_system_tracking_sync ON system_tracking(synced);
                `;

        db.serialize(() => {
          db.run("PRAGMA foreign_keys = ON;");
          db.run("PRAGMA journal_mode = WAL;");
          db.exec(createTableSQL, (execErr) => {
            if (execErr) {
              reject(execErr);
            } else {
              resolve(db);
            }
          });
        });
      }
    );
  });
}

async function initializeDatabase() {
  try {
    if (!config.dbPath) {
      throw new Error("Database path is not defined");
    }

    await ensureDirectories();
    loadDatabaseDriver();

    if (isUsingSqlite3) {
      db = await createDatabase();
      console.log("Database created successfully");

      if (fsSync.existsSync(config.dbPath)) {
        try {
          await fs.chmod(config.dbPath, 0o600);
          console.log("Database permissions set successfully");
        } catch (chmodError) {
          console.warn(
            "Warning: Could not set database file permissions:",
            chmodError
          );
        }
      }

      return db;
    } else {
      db = betterSqlite3(config.dbPath, {
        verbose: console.log,
        fileMustExist: false,
      });

      db.pragma("foreign_keys = ON");
      db.pragma("journal_mode = WAL");

      const createTableSQL = `
                CREATE TABLE IF NOT EXISTS system_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    mac_address VARCHAR(17) NOT NULL,
                    username TEXT NOT NULL,
                    active_time TEXT NOT NULL,
                    date DATE NOT NULL,
                    location TEXT,
                    synced BOOLEAN DEFAULT 0,
                    sync_time TIMESTAMP,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_system_tracking_date ON system_tracking(date);
                CREATE INDEX IF NOT EXISTS idx_system_tracking_mac ON system_tracking(mac_address);
                CREATE INDEX IF NOT EXISTS idx_system_tracking_sync ON system_tracking(synced);
            `;

      db.exec(createTableSQL);

      if (fsSync.existsSync(config.dbPath)) {
        try {
          await fs.chmod(config.dbPath, 0o600);
          console.log("Database permissions set successfully");
        } catch (chmodError) {
          console.warn(
            "Warning: Could not set database file permissions:",
            chmodError
          );
        }
      }

      return db;
    }
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

async function logSystemTracking(
  macAddress,
  username,
  activeTime,
  date,
  location
) {
  return new Promise((resolve, reject) => {
    const database = getDatabase();

    if (isUsingSqlite3) {
      database.get(
        "SELECT * FROM system_tracking WHERE mac_address = ? AND date = ?",
        [macAddress, date],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            database.run(
              `UPDATE system_tracking 
                             SET active_time = ?, location = ?, synced = 0 
                             WHERE mac_address = ? AND date = ?`,
              [activeTime, location, macAddress, date],
              (updateErr) => {
                if (updateErr) reject(updateErr);
                else resolve();
              }
            );
          } else {
            database.run(
              `INSERT INTO system_tracking 
                             (mac_address, username, active_time, date, location, synced) 
                             VALUES (?, ?, ?, ?, ?, 0)`,
              [macAddress, username, activeTime, date, location],
              (insertErr) => {
                if (insertErr) reject(insertErr);
                else resolve();
              }
            );
          }
        }
      );
    } else {
      try {
        const row = database
          .prepare(
            "SELECT * FROM system_tracking WHERE mac_address = ? AND date = ?"
          )
          .get(macAddress, date);

        if (row) {
          database
            .prepare(
              `UPDATE system_tracking 
                             SET active_time = ?, location = ?, synced = 0 
                             WHERE mac_address = ? AND date = ?`
            )
            .run(activeTime, location, macAddress, date);
        } else {
          database
            .prepare(
              `INSERT INTO system_tracking 
                             (mac_address, username, active_time, date, location, synced) 
                             VALUES (?, ?, ?, ?, ?, 0)`
            )
            .run(macAddress, username, activeTime, date, location);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    }
  });
}

async function syncDatabase() {
  if (!(await isOnline())) {
    console.log("Device is offline. Skipping sync.");
    return;
  }

  const database = getDatabase();
  if (!database) {
    console.log("Database not initialized");
    return;
  }

  try {
    let rows;
    if (isUsingSqlite3) {
      rows = await new Promise((resolve, reject) => {
        database.all(
          `SELECT * FROM system_tracking WHERE synced = 0 ORDER BY date ASC`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    } else {
      rows = database
        .prepare(
          `SELECT * FROM system_tracking WHERE synced = 0 ORDER BY date ASC`
        )
        .all();
    }

    if (!rows || rows.length === 0) {
      console.log("No new data to sync");
      return;
    }

    const response = await axios.post(config.syncUrl, { data: rows });

    if (response.data.success) {
      console.log(`Successfully synced ${rows.length} records`);
      await markRecordsAsSynced(rows.map((r) => r.id));
      await cleanupSyncedData();
    }
  } catch (error) {
    console.error("Error syncing database:", error);
  }
}

async function markRecordsAsSynced(ids) {
  const database = getDatabase();
  const syncTime = new Date().toISOString();

  if (isUsingSqlite3) {
    return new Promise((resolve, reject) => {
      database.run(
        `UPDATE system_tracking SET synced = 1, sync_time = ? WHERE id IN (${ids.join(
          ","
        )})`,
        [syncTime],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  } else {
    database
      .prepare(
        `UPDATE system_tracking SET synced = 1, sync_time = ? WHERE id IN (${ids.join(
          ","
        )})`
      )
      .run(syncTime);
  }
}

async function cleanupSyncedData() {
  const database = getDatabase();
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - config.retentionDays);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    if (isUsingSqlite3) {
      await new Promise((resolve, reject) => {
        database.run(
          `DELETE FROM system_tracking WHERE date < ? AND synced = 1`,
          [cutoffDate],
          function (err) {
            if (err) {
              reject(err);
            } else {
              console.log(`Cleaned up ${this.changes} old records`);
              resolve();
            }
          }
        );
      });

      await new Promise((resolve, reject) => {
        database.run("VACUUM", (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      const result = database
        .prepare(`DELETE FROM system_tracking WHERE date < ? AND synced = 1`)
        .run(cutoffDate);

      console.log(`Cleaned up ${result.changes} old records`);
      database.exec("VACUUM");
    }

    console.log("Database cleanup completed");
  } catch (error) {
    console.error("Error during database cleanup:", error);
  }
}

async function closeDatabase() {
  if (db) {
    try {
      await syncDatabase(); // Final sync attempt
      if (isUsingSqlite3) {
        await new Promise((resolve, reject) => {
          db.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } else {
        db.close();
      }
      console.log("Database connection closed");
      db = null;
    } catch (error) {
      console.error("Error closing database:", error);
      throw error;
    }
  }
}

async function backupDatabase() {
  try {
    if (!fsSync.existsSync(config.dbPath)) {
      console.log("No database file to backup");
      return;
    }

    // Create backup in the backups subdirectory
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      config.databaseDir,
      "backups",
      `backup_${timestamp}.db`
    );

    await fs.copyFile(config.dbPath, backupPath);
    console.log(`Database backed up to: ${backupPath}`);

    // Keep only last N backups
    const backupDir = path.join(config.databaseDir, "backups");
    const backups = (await fs.readdir(backupDir))
      .filter((file) => file.startsWith("backup_") && file.endsWith(".db"))
      .sort()
      .reverse();

    if (backups.length > config.maxBackups) {
      for (const oldBackup of backups.slice(config.maxBackups)) {
        await fs.unlink(path.join(backupDir, oldBackup));
      }
    }
  } catch (error) {
    console.error("Error backing up database:", error);
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  logSystemTracking,
  syncDatabase,
  closeDatabase,
  backupDatabase,
  cleanupSyncedData,
};
