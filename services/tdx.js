const axios = require("axios");

const TDX_AUTH_URL =
  "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const TDX_API_BASE = "https://tdx.transportdata.tw/api/basic";

// ⚠️ 用環境變數，不寫死
const CLIENT_ID = process.env.TDX_CLIENT_ID;
const CLIENT_SECRET = process.env.TDX_CLIENT_SECRET;

let accessToken = null;
let tokenExpireAt = 0;

// ==============================
// 取得 Access Token（自動快取）
// ==============================
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpireAt) {
    return accessToken;
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  const res = await axios.post(TDX_AUTH_URL, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  accessToken = res.data.access_token;
  tokenExpireAt = now + res.data.expires_in * 1000 - 60_000; // 提前 1 分鐘過期

  return accessToken;
}

// ==============================
// 查高鐵時刻表
// ==============================
async function getHSRTimetable(originId, destId, date) {
  const token = await getAccessToken();

  const url = `${TDX_API_BASE}/v2/Rail/THSR/DailyTimetable/Origin/${originId}/Destination/${destId}/${date}?$format=JSON`;

  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  return res.data;
}

module.exports = {
  getHSRTimetable
};
