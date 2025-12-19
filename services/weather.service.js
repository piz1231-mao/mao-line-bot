const axios = require("axios");

const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";

// 中央氣象署正式縣市名稱
const CITY_MAP = {
  "台北": "臺北市",
  "台北市": "臺北市",
  "臺北": "臺北市",
  "臺北市": "臺北市",

  "新北": "新北市",
  "新北市": "新北市",

  "桃園": "桃園市",
  "桃園市": "桃園市",

  "台中": "臺中市",
  "台中市": "臺中市",
  "臺中": "臺中市",
  "臺中市": "臺中市",

  "台南": "臺南市",
  "台南市": "臺南市",
  "臺南": "臺南市",
  "臺南市": "臺南市",

  "高雄": "高雄市",
  "高雄市": "高雄市",

  "宜蘭": "宜蘭縣",
  "花蓮": "花蓮縣",
  "台東": "臺東縣",
  "臺東": "臺東縣",
  "屏東": "屏東縣",
  "澎湖": "澎湖縣",
  "金門": "金門縣",
  "連江": "連江縣"
};

function normalizeCity(input) {
  if (!input || input.trim() === "") return DEFAULT_CITY;
  return CITY_MAP[input.trim()] || DEFAULT_CITY;
}

/**
 * 取得 36 小時天氣
 */
async function get36hrWeather(cityName) {
  const city = normalizeCity(cityName);

  const url =
    "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

  const res = await axios.get(url, {
    params: {
      Authorization: process.env.CWA_API_KEY, // ← 一定要確認這個有值
      locationName: city
    },
    timeout: 5000
  });

  const data = res.data;

  // ===== 關鍵防呆 =====
  if (!data || data.success !== "true") {
    throw new Error(
      `CWA API error: ${data?.msg || "unknown error"}`
    );
  }

  const locations = data.records?.location;
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error(`No weather data for city: ${city}`);
  }

  return locations[0];
}

module.exports = {
  get36hrWeather
};
