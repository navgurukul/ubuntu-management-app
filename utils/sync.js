const axios = require("axios");
const { isOnline } = require("./network");
const { getDatabase } = require("./database");

async function syncDatabase() {
  if (await isOnline()) {
    const db = getDatabase();

    if (!db) {
      console.error("Database not initialized");
      return;
    }

    db.all(`SELECT * FROM system_tracking`, async (err, rows) => {
      if (err) {
        console.error("Error reading from database:", err.message);
        return;
      }

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
  } else {
    console.log("Laptop is offline. Skipping database sync.");
  }
}

module.exports = { syncDatabase };
