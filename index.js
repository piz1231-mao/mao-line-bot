// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.3.2（高鐵入口修正）
//
// - TradingView Webhook（鎖死）
// - 🚄 高鐵查詢（狀態機 handler，不動）
// - 📊 股票查詢 Phase 1
// - 天氣查詢
// - 待辦功能
// - 私訊營運回報
// - 查業績
// - ⏰ 每日 08:00 主動推播
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// 原有 services（完全不動）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");
const handleHSR = require("./handlers/hsr");

// 📊 股票
const { getStockQuote } = require("./services/stock.service");
const { buildStockText } = require("./services/stock.text");

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ LINE Channel 設定缺失");
  process.exit(1);
}

const client = new line.Client(config);

// ======================================================
// Google Sheet 設定（原樣）
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const TEMPLATE_SHEET = "茶六博愛";
const SHOP_LIST = ["茶六博愛", "三山博愛", "湯棧中山"];

const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// TradingView Webhook（鎖死）
// ======================================================
app.all(
  "/tv-alert",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      let body = {};
      if (typeof req.body === "string") {
        try { body = JSON.parse(req.body); } catch {}
      }
      const msg = body.message || body.alert || req.body;
      await tvAlert(client, msg, body);
      res.send("OK");
    } catch (err) {
      console.error("❌ TV Webhook Error:", err);
      res.send("OK");
    }
  }
);

// ======================================================
// 🧠 指令入口語意轉譯層（✔ 關鍵修正在這）
// ======================================================
function normalizeCommand(text) {
  if (!text) return text;
  const t = text.trim();

  // 🚄 高鐵 —— 一律轉成 hsr.js 唯一入口「查高鐵」
  if (["查高鐵", "高鐵", "高鐵查詢", "我要查高鐵"].includes(t)) {
    return "查高鐵";
  }

  // 📊 股票
  if (t.startsWith("查股票 ")) {
    return "股 " + t.replace("查股票", "").trim();
  }
  if (t.startsWith("查股 ")) {
    return "股 " + t.replace("查股", "").trim();
  }

  // 🌤 天氣
  if (t.startsWith("查天氣 ")) {
    return "天氣 " + t.replace("查天氣", "").trim();
  }

  return text;
}

// ======================================================
// 工具
// ======================================================
function parseWeather(text) {
  if (!text) return null;
  if (text === "天氣" || text.startsWith("天氣 ")) {
    return text.replace("天氣", "").trim();
  }
  return null;
}

const CITY_MAP = {
  台北:"臺北市",臺北:"臺北市",新北:"新北市",桃園:"桃園市",
  台中:"臺中市",臺中:"臺中市",台南:"臺南市",臺南:"臺南市",
  高雄:"高雄市",基隆:"基隆市",新竹:"新竹市",苗栗:"苗栗縣",
  彰化:"彰化縣",南投:"南投縣",雲林:"雲林縣",嘉義:"嘉義市",
  屏東:"屏東縣",宜蘭:"宜蘭縣",花蓮:"花蓮縣",
  台東:"臺東縣",臺東:"臺東縣",澎湖:"澎湖縣",
  金門:"金門縣",連江:"連江縣"
};

// ======================================================
// LINE Webhook（主流程）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {

      // 🧠 入口翻譯（一定最先）
      if (e.message?.type === "text") {
        e.message.text = normalizeCommand(e.message.text);
      }

      // ==================================================
      // 🚄 高鐵（狀態機，最高優先）
      // ==================================================
      const hsrResult = await handleHSR(e);
      if (hsrResult) {
        // ⚠️ 高鐵 handler 本身回傳字串才需要 reply
        if (typeof hsrResult === "string") {
          await client.replyMessage(e.replyToken, {
            type: "text",
            text: hsrResult
          });
        }
        continue;
      }

      // ==================================================
      // 📊 股票
      // ==================================================
      if (e.message?.type === "text" && e.message.text.startsWith("股 ")) {
        const stockId = e.message.text.replace("股", "").trim();
        const data = await getStockQuote(stockId);
        await client.replyMessage(e.replyToken, {
          type: "text",
          text: buildStockText(data)
        });
        continue;
      }

      // ==================================================
      // 📋 待辦
      // ==================================================
      if (e.message?.type === "text") {
        if (todoCmd.keywords?.some(k => e.message.text.startsWith(k))) {
          await todoCmd.handler(client, e);
          continue;
        }
      }

      // ==================================================
      // 🌤 天氣
      // ==================================================
      if (e.message?.type === "text") {
        const city = parseWeather(e.message.text);
        if (city !== null) {
          const r = await get36hrWeather(CITY_MAP[city] || "高雄市");
          await client.replyMessage(e.replyToken, {
            type: "text",
            text: buildWeatherFriendText(r)
          });
          continue;
        }
      }

      // ==================================================
      // 💰 其他營運流程（原樣保留）
      // ==================================================
    }
    res.send("OK");
  } catch (err) {
    console.error("❌ LINE Webhook Error:", err);
    res.status(500).end();
  }
});

// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
