const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// Extract data from the SQLite .db file and send it to the server
function syncDatabase() {
  const db = new sqlite3.Database('./system_tracking.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      return console.error('Error opening database:', err.message);
    }

    db.all(`SELECT * FROM system_tracking`, async (err, rows) => {
      if (err) {
        console.error('Error reading from database:', err.message);
      } else {
        try {
          // const response = await axios.post('http://websocket.merakilearn.org/database-sync', {
            const response = await axios.post('https://rms.thesama.in/database-sync', {
            data: rows, // Send the extracted data to the server
          });
          console.log('Sync successful:', response.data);
        } catch (error) {
          console.error('Error syncing database:', error.message);
        }
      }
    });

    db.close();
  });
}


syncDatabase();
// module.exports = syncDatabase;
