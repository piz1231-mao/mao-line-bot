// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.2（穩定功能鎖死）＋
// A-2 茶六博愛｜分類寫入 v1
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ LINE_CHANNEL_ACCESS_TOKEN 或 LINE_CHANNEL_SECRET 未設定");
  process.exit(1);
}

const client = new line.Client(config);

// ======================================================
// 舊有穩定 services（不動）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const todoCmd = require("./commands/chat/todo");
const tvAlert = require("./services/tvAlert");

// ======================================================
// Google Sheet 設定
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SALES_SHEET_NAME = "茶六博愛";

const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// TradingView Webhook（原樣保留）
// ======================================================
app.all(
  "/tv-alert",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      let body = {};
      let content = req.body || "";
      if (typeof content === "string") {
        try { body = JSON.parse(content); } catch {}
      }
      const msg = body.message || body.alert || content;
      const price = body.close ?? body.price ?? null;
      await tvAlert(client, msg, { ...body, price });
      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ TV Webhook Error:", err);
      res.status(200).send("OK");
    }
  }
);

// ======================================================
// 天氣（舊有功能，不動）
// ======================================================
function parseCommand(text) {
  if (!text) return null;
  const t = text.trim();
  if (t === "天氣" || t.startsWith("天氣 ")) {
    return { command: "WEATHER", arg: t.replace("天氣", "").trim() };
  }
  return null;
}

const CITY_MAP = {
  "台北": "臺北市", "臺北": "臺北市",
  "新北": "新北市", "桃園": "桃園市",
  "台中": "臺中市", "臺中": "臺中市",
  "台南": "臺南市", "臺南": "臺南市",
  "高雄": "高雄市", "基隆": "基隆市",
  "新竹": "新竹市", "苗栗": "苗栗縣",
  "彰化": "彰化縣", "南投": "南投縣",
  "雲林": "雲林縣", "嘉義": "嘉義市",
  "屏東": "屏東縣", "宜蘭": "宜蘭縣",
  "花蓮": "花蓮縣", "台東": "臺東縣",
  "臺東": "臺東縣", "澎湖": "澎湖縣",
  "金門": "金門縣", "連江": "連江縣"
};

// ======================================================
// 🧠 分類解析工具（茶六博愛 v1）
// ======================================================
function parseBusinessDate(text) {
  const m = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  const year = new Date().getFullYear();
  const mm = m[1].padStart(2, "0");
  const dd = m[2].padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseRevenue(text) {
  const m = text.match(/業績\s*[:：]\s*([\d,]+)/);
  if (!m) return "";
  return Number(m[1].replace(/,/g, ""));
}

// ======================================================
// 寫入分類欄位（E～H）
// ======================================================
async function appendSalesWithCategory({
  timestamp, userId, sourceId, rawText
}) {
  const clientAuth = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: clientAuth });

  const businessDate = parseBusinessDate(rawText);
  const revenue = parseRevenue(rawText);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SALES_SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        timestamp,          // A
        userId,             // B
        sourceId,           // C
        rawText,            // D
        "茶六博愛",         // E 店別
        businessDate,       // F 營業日期
        revenue,            // G 總業績
        "業績"              // H 回報類型
      ]]
    }
  });
}

// ======================================================
// 私訊業績回報（A-2）
// ======================================================
async function handlePrivateSales(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  const timestamp = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei"
  });

  try {
    await appendSalesWithCategory({
      timestamp,
      userId: event.source.userId,
      sourceId: event.source.userId,
      rawText: text
    });
  } catch (err) {
    console.error("❌ 茶六博愛分類寫入失敗", err);
  }

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "已記錄"
  });

  return true;
}

// ======================================================
// LINE Webhook
// ======================================================
app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    try {
      for (const event of req.body.events || []) {

        // ① 業績回報（私訊）
        if (await handlePrivateSales(event)) continue;

        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;
        const text = event.message.text.trim();

        // ② 待辦（舊有）
        if (
          todoCmd.keywords &&
          todoCmd.keywords.some(k => text.startsWith(k))
        ) {
          await todoCmd.handler(client, event);
          continue;
        }

        // ③ 天氣（舊有）
        const parsed = parseCommand(text);
        if (parsed && parsed.command === "WEATHER") {
          let city = CITY_MAP[parsed.arg] || (process.env.DEFAULT_CITY || "高雄市");
          const result = await get36hrWeather(city);
          const reply = buildWeatherFriendText(result);
          await client.replyMessage(event.replyToken, { type: "text", text: reply });
          continue;
        }
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ LINE Webhook Error:", err);
      res.status(500).end();
    }
  }
);

// ======================================================
// 啟動 Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
