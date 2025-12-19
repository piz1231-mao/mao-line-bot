const axios = require("axios");

const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄";

/**
 * 取得 36 小時天氣資料
 * @param {string} cityName - 縣市名稱（可選）
 */
async function get36hrWeather(cityName) {
  const city = cityName && cityName.trim() !== ""
    ? cityName.trim()
    : DEFAULT_CITY;

  // 你的原本 API（以下為示意，URL 請用你現在那條）
  const url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

  const res = await axios.get(url, {
    params: {
      Authorization: process.env.CWA_API_KEY,
      locationName: city
    },
    timeout: 5000
  });

  const locations = res.data?.records?.location;
  if (!locations || locations.length === 0) {
    throw new Error(`No weather data for city: ${city}`);
  }

  return locations[0];
}

module.exports = {
  get36hrWeather
};
