const axios = require("axios");

const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";

const CITY_MAP = {
  "台北": "臺北市",
  "台北市": "臺北市",
  "臺北": "臺北市",
  "臺北市": "臺北市",
  "新北": "新北市",
  "桃園": "桃園市",
  "台中": "臺中市",
  "臺中": "臺中市",
  "台南": "臺南市",
  "臺南": "臺南市",
  "高雄": "高雄市",
  "花蓮": "花蓮縣",
  "台東": "臺東縣",
  "臺東": "臺東縣"
};

function normalizeCity(input) {
  if (!input || input.trim() === "") return DEFAULT_CITY;
  return CITY_MAP[input.trim()] || DEFAULT_CITY;
}

async function get36hrWeather(cityName) {
  const city = normalizeCity(cityName);

  const url =
    "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

  const res = await axios.get(url, {
    params: {
      Authorization: process.env.CWA_API_KEY
      // ⚠️ 不用 locationName，先整包拿
    },
    timeout: 5000
  });

  const data = res.data;

  if (!data || data.success !== "true") {
    throw new Error(`CWA API error: ${data?.msg || "unknown"}`);
  }

  // 🔑 關鍵：只在 service 裡篩選城市
  const locations = data.records?.location;
  if (!Array.isArray(locations)) {
    throw new Error("Invalid weather data format");
  }

  const target = locations.find(l => l.locationName === city);
  if (!target) {
    throw new Error(`No weather data for city: ${city}`);
  }

  // ✅ 回傳「舊格式」，但只剩目標城市
  return {
    ...data,
    records: {
      ...data.records,
      location: [target]
    }
  };
}

module.exports = {
  get36hrWeather
};
