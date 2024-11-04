const axios = require("axios");
const sqlite3 = require("sqlite3");
const { DB_PATH } = require("../config/constants");

class DatabaseSync {
  static async syncDatabase() {
    const dbInstance = new sqlite3.Database(
      DB_PATH,
      sqlite3.OPEN_READONLY,
      (err) => {
        if (err) return console.error("Error opening database:", err.message);

        dbInstance.all(`SELECT * FROM system_tracking`, async (err, rows) => {
          if (err)
            return console.error("Error reading from database:", err.message);

          try {
            const response = await axios.post(
              "https://rms.thesama.in/database-sync",
              { data: rows }
            );
            console.log("Sync successful:", response.data);
          } catch (error) {
            console.error("Error syncing database:", error.message);
          }
        });

        dbInstance.close();
      }
    );
  }
}
module.exports = DatabaseSync;