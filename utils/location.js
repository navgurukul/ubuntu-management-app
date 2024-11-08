const axios = require("axios");
const { isOnline } = require("./network");

async function getLocation() {
  if (await isOnline()) {
    try {
      const response = await axios.get("http://ip-api.com/json/");
      const { city, regionName, country } = response.data;
      return `${city}, ${regionName}, ${country}`;
    } catch (error) {
      console.error("Error fetching location:", error.message);
      return "Unknown Location";
    }
  } else {
    console.log("Laptop is offline. Unable to fetch location.");
    return "Unknown Location";
  }
}

module.exports = { getLocation };
