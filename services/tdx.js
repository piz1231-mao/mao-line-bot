const axios = require("axios");

const AUTH_URL =
  "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const API_BASE = "https://tdx.transportdata.tw/api/basic";

const CLIENT_ID = process.env.TDX_CLIENT_ID;
const CLIENT_SECRET = process.env.TDX_CLIENT_SECRET;

let cachedToken = null;
let tokenExpireAt = 0;

async function getToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpireAt) return cachedToken;

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  const res = await axios.post(AUTH_URL, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" }
  });

  cachedToken = res.data.access_token;
  tokenExpireAt = now + res.data.expires_in * 1000 - 60_000;
  return cachedToken;
}

async function getHSRTimetable(originId, destId, date) {
  const token = await getToken();

  const url =
    `${API_BASE}/v2/Rail/THSR/DailyTimetable/OD/${originId}/to/${destId}/${date}?$format=JSON`;

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return res.data;
}

module.exports = { getHSRTimetable };
