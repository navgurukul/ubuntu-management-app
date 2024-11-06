const axios = require("axios");
const config = require("../config/config");
const { isOnline } = require("../utils/networkUtils");

async function getLocation() {
  if (await isOnline()) {
    try {
      const response = await axios.get(config.locationApiUrl);
      const { city, regionName, country } = response.data;
      return `${city}, ${regionName}, ${country}`;
    } catch (error) {
      console.error("Error fetching location:", error.message);
      return "Unknown Location";
    }
  }
  return "Unknown Location";
}

module.exports = {
  getLocation,
};
