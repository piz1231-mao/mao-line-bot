// ======================================================
// 中央氣象署 36hr 天氣服務（穩定版｜永不 throw）
// ======================================================

const axios = require("axios");

const CWA_API =
  "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

async function get36hrWeather(city) {
  const apiKey = process.env.CWA_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      error: "NO_API_KEY"
    };
  }

  try {
    const res = await axios.get(CWA_API, {
      params: {
        Authorization: apiKey
      },
      timeout: 8000
    });

    const locations = res?.data?.records?.location;
    if (!Array.isArray(locations)) {
      return {
        ok: false,
        error: "NO_LOCATION_LIST"
      };
    }

    const location = locations.find(
      l => l.locationName === city
    );

    if (!location || !Array.isArray(location.weatherElement)) {
      return {
        ok: false,
        error: "CITY_NOT_FOUND",
        city
      };
    }

    return {
      ok: true,
      city,
      weatherElement: location.weatherElement
    };
  } catch (err) {
    console.error("🌧 CWA API ERROR:", err.message);

    return {
      ok: false,
      error: "API_ERROR"
    };
  }
}

module.exports = {
  get36hrWeather
};
