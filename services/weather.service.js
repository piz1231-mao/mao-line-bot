// ======================================================
// 中央氣象署 36hr 天氣服務（結構定版）
// ======================================================

const axios = require("axios");

const CWA_API =
  "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

async function get36hrWeather(city) {
  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) {
    throw new Error("CWA_API_KEY not set");
  }

  const res = await axios.get(CWA_API, {
    params: {
      Authorization: apiKey,
      locationName: city
    },
    timeout: 8000
  });

  const locations = res?.data?.records?.location;
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error("No location data from CWA");
  }

  const location = locations.find(l => l.locationName === city);
  if (!location || !Array.isArray(location.weatherElement)) {
    throw new Error("weatherElement not found in CWA response");
  }

  // 🔒 統一回傳格式（非常重要）
  return {
    city,
    weatherElement: location.weatherElement
  };
}

module.exports = {
  get36hrWeather
};
