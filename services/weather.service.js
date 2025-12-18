const axios = require("axios");

const CWA_API_KEY = process.env.CWA_API_KEY;
const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";

async function get36hrWeather(city) {
  const targetCity = city || DEFAULT_CITY;

  const url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001";

  const res = await axios.get(url, {
    params: {
      Authorization: CWA_API_KEY,
      locationName: targetCity
    }
  });

  if (!res.data.records.location.length) {
    throw new Error(`找不到氣象資料：${targetCity}`);
  }

  return {
    city: targetCity,
    data: res.data.records.location[0]
  };
}
