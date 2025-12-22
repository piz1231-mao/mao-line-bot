// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.2（穩定功能鎖死）＋
// A-1 業績回報：私訊 → 原文寫入 Google Sheet
// - 自動建立分頁（茶六博愛）
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
// 自家 services（舊有穩定功能）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

// ======================================================
// chat 指令模組（待辦｜舊有功能）
// ======================================================
const todoCmd = require("./commands/chat/todo");

// ======================================================
// Google Sheet 設定（業績回報用）
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
const tvAlert = require("./services/tvAlert");

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
// 天氣指令解析（舊有行為保留）
// ======================================================
function parseCommand(text) {
  if (!text) return null;
  const t = text.trim();

  if (t === "天氣" || t.startsWith("天氣 ")) {
    return {
      command: "WEATHER",
      arg: t.replace("天氣", "").trim()
    };
  }
  return null;
}

// ======================================================
// 城市正規化表（完整鎖死版）
// ======================================================
const CITY_MAP = {
  "台北": "臺北市",
  "臺北": "臺北市",
  "新北": "新北市",
  "桃園": "桃園市",
  "台中": "臺中市",
  "臺中": "臺中市",
  "台南": "臺南市",
  "臺南": "臺南市",
  "高雄": "高雄市",
  "基隆": "基隆市",
  "新竹": "新竹市",
  "苗栗": "苗栗縣",
  "彰化": "彰化縣",
  "南投": "南投縣",
  "雲林": "雲林縣",
  "嘉義": "嘉義市",
  "屏東": "屏東縣",
  "宜蘭": "宜蘭縣",
  "花蓮": "花蓮縣",
  "台東": "臺東縣",
  "臺東": "臺東縣",
  "澎湖": "澎湖縣",
  "金門": "金門縣",
  "連江": "連江縣"
};

// ======================================================
// Google Sheet 工具：確保分頁存在
// ======================================================
async function ensureSheetExists(sheetName) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID
  });

  const exists = meta.data.sheets.some(
    s => s.properties.title === sheetName
  );

  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        addSheet: {
          properties: { title: sheetName }
        }
      }]
    }
  });

  // 建立標題列
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        "時間",
        "回報者 userId",
        "來源 sourceId",
        "原始回報內容"
      ]]
    }
  });
}

// ======================================================
// 寫入業績回報（原文保存）
// ======================================================
async function appendSalesRaw({ timestamp, userId, sourceId, rawText }) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await ensureSheetExists(SALES_SHEET_NAME);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SALES_SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[timestamp, userId, sourceId, rawText]]
    }
  });
}

// ======================================================
// 🧪 私訊測試（業績回報 A-1）
// ======================================================
async function handlePrivateSalesTest(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  const timestamp = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei"
  });

  const sourceId = event.source.userId;

  try {
    await appendSalesRaw({
      timestamp,
      userId: event.source.userId,
      sourceId,
      rawText: text
    });
  } catch (err) {
    console.error("❌ 業績回報寫入失敗", err);
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
        if (await handlePrivateSalesTest(event)) continue;

        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const text = event.message.text.trim();

        // ② 待辦（舊有功能）
        if (
          todoCmd.keywords &&
          todoCmd.keywords.some(k => text.startsWith(k))
        ) {
          await todoCmd.handler(client, event);
          continue;
        }

        // ③ 天氣（舊有功能）
        const parsed = parseCommand(text);
        if (parsed && parsed.command === "WEATHER") {
          const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";
          let city = DEFAULT_CITY;

          if (parsed.arg && CITY_MAP[parsed.arg]) {
            city = CITY_MAP[parsed.arg];
          }

          const result = await get36hrWeather(city);
          const reply = buildWeatherFriendText(result);

          await client.replyMessage(event.replyToken, {
            type: "text",
            text: reply
          });
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
