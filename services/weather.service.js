// ======================================================
// 中央氣象署 36hr 天氣服務（穩定版，不用 API filter）
// ======================================================

const axios = require("axios");

const CWA_API =
  "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

async function get36hrWeather(city) {
  const apiKey = process.env.CWA_API_KEY;
  if (!apiKey) {
    throw new Error("CWA_API_KEY not set");
  }

  // ⚠️ 不用 locationName filter，整包抓
  const res = await axios.get(CWA_API, {
    params: {
      Authorization: apiKey
    },
    timeout: 8000
  });

  const locations = res?.data?.records?.location;
  if (!Array.isArray(locations)) {
    throw new Error("No location list from CWA");
  }

  const location = locations.find(l => l.locationName === city);
  if (!location || !Array.isArray(location.weatherElement)) {
    throw new Error(`City not found in CWA data: ${city}`);
  }

  return {
    city,
    weatherElement: location.weatherElement
  };
}

module.exports = {
  get36hrWeather
};
