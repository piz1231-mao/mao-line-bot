// services/tdx.js
const axios = require("axios");

const BASE_URL = "https://tdx.transportdata.tw/api/basic/v2";
const CLIENT_ID = process.env.TDX_CLIENT_ID;
const CLIENT_SECRET = process.env.TDX_CLIENT_SECRET;

let tokenCache = {
  access_token: null,
  expire_at: 0
};

async function getToken() {
  const now = Date.now();
  if (tokenCache.access_token && now < tokenCache.expire_at) {
    return tokenCache.access_token;
  }

  const res = await axios.post(
    "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token",
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  tokenCache.access_token = res.data.access_token;
  tokenCache.expire_at = now + (res.data.expires_in - 60) * 1000;
  return tokenCache.access_token;
}

/**
 * 取得「當天全部高鐵班次」
 */
async function getHSRAllTimetable(date) {
  const token = await getToken();

  const url = `${BASE_URL}/Rail/THSR/DailyTimetable/TrainDate/${date}`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return res.data;
}

module.exports = {
  getHSRAllTimetable
};
