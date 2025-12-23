// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.2（穩定功能鎖死）＋
// A-3 茶六博愛｜經營欄位解析 v1（含總人事備援）
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
// 舊有穩定功能（完全不動）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const todoCmd = require("./commands/chat/todo");
const tvAlert = require("./services/tvAlert");

// ======================================================
// Google Sheet 設定
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "茶六博愛";

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
// 天氣（舊有，不動）
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
// 解析工具（茶六博愛 v1）
// ======================================================
function parseBusinessDate(text) {
  const m = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  const year = new Date().getFullYear();
  return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function num(v) {
  if (!v) return "";
  return Number(v.replace(/,/g, ""));
}

function parseRevenue(text) {
  const m = text.match(/業績\s*[:：]\s*([\d,]+)/);
  return m ? num(m[1]) : "";
}

function parseSingle(text, regex) {
  const m = text.match(regex);
  return m ? num(m[1]) : "";
}

function parsePercent(text, regex) {
  const m = text.match(regex);
  return m ? Number(m[1]) : "";
}

// ======================================================
// 寫入 A～P（含總人事備援）
// ======================================================
async function appendSalesRow(rawText, userId) {
  const clientAuth = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: clientAuth });

  const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

  const businessDate = parseBusinessDate(rawText);
  const revenue = parseRevenue(rawText);

  const packages = parseSingle(rawText, /套餐份數\s*[:：]\s*([\d,]+)/);
  const unitPrice = parseSingle(rawText, /客單價\s*[:：]\s*([\d.]+)/);

  const frontPay = parseSingle(rawText, /外場薪資\s*([\d,]+)/);
  const frontPct = parsePercent(rawText, /外場薪資[\d,]+。([\d.]+)%/);

  const backPay = parseSingle(rawText, /內場薪資\s*([\d,]+)/);
  const backPct = parsePercent(rawText, /內場薪資[\d,]+。([\d.]+)%/);

  let totalPay = parseSingle(rawText, /總人事\s*[:：]\s*([\d,]+)/);
  let totalPct = parsePercent(rawText, /總人事[:：][\d,]+。([\d.]+)%/);

  // 🔑 備援補算
  if (!totalPay && frontPay && backPay) {
    totalPay = frontPay + backPay;
  }
  if (!totalPct && frontPct && backPct) {
    totalPct = Number((frontPct + backPct).toFixed(2));
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        timestamp,        // A
        userId,           // B
        userId,           // C
        rawText,          // D
        "茶六博愛",       // E
        businessDate,     // F
        revenue,          // G
        "業績",           // H
        packages,         // I
        unitPrice,        // J
        frontPay,         // K
        frontPct,         // L
        backPay,          // M
        backPct,          // N
        totalPay,         // O
        totalPct          // P
      ]]
    }
  });
}

// ======================================================
// 私訊業績回報（茶六博愛）
// ======================================================
async function handlePrivateSales(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  try {
    await appendSalesRow(text, event.source.userId);
  } catch (err) {
    console.error("❌ 茶六博愛 A-3 寫入失敗", err);
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

        if (await handlePrivateSales(event)) continue;

        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;
        const text = event.message.text.trim();

        if (
          todoCmd.keywords &&
          todoCmd.keywords.some(k => text.startsWith(k))
        ) {
          await todoCmd.handler(client, event);
          continue;
        }

        const parsed = parseCommand(text);
        if (parsed && parsed.command === "WEATHER") {
          let city = CITY_MAP[parsed.arg] || (process.env.DEFAULT_CITY || "高雄市");
          const result = await get36hrWeather(city);
          const reply = buildWeatherFriendText(result);
          await client.replyMessage(event.replyToken, { type: "text", text: reply });
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
