// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 重構穩定版 v1.4.0（正式定版）
//
// 【架構定位】
// ------------------------------------------------------
// - index.js 為「唯一 Router / 裁判」
// - 所有指令先在此判斷，不允許模組互相搶事件
// - 狀態型功能（如高鐵）僅在被指派時啟動
//
// 【功能總覽】
// ------------------------------------------------------
// 即時指令（無狀態，高優先）
// - 📊 股票查詢：股 2330 / 查股票 3189
// - 🌤 天氣查詢：天氣 台中 / 查天氣 雲林
// - 📋 待辦事項：待辦：XXX
// - 📈 查業績：查業績 / 查業績 茶六博愛
//
// 狀態型流程（明確起手）
// - 🚄 高鐵查詢：查高鐵 → 北上/南下 → 起訖站 → 時間
//
// 系統功能
// - TradingView Webhook（鎖死）
// - Google Sheet 業績寫入與查詢
//
// 【重要規範】
// ------------------------------------------------------
// ⚠️ 新增功能一律只動 index.js + 新模組
// ⚠️ 不得在狀態機模組內判斷其他指令
// ⚠️ 高鐵模組已完全解耦，不可再加 escape 判斷
//
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// Services（全部沿用，不動）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");
const handleHSR = require("./handlers/hsr");
const { getStockQuote } = require("./services/stock.service");
const { buildStockText } = require("./services/stock.text");

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ======================================================
// Google Sheet 設定
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
app.all("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let body = {};
    if (typeof req.body === "string") {
      try { body = JSON.parse(req.body); } catch {}
    }
    const msg = body.message || body.alert || req.body;
    await tvAlert(client, msg, body);
    res.send("OK");
  } catch {
    res.send("OK");
  }
});

// ======================================================
// 工具
// ======================================================
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
const num = v => (v ? Number(String(v).replace(/,/g, "")) : "");

// ======================================================
// 天氣
// ======================================================
function parseWeather(text) {
  const t = text.trim();
  if (t === "天氣" || t.startsWith("天氣 ")) return t.replace("天氣", "").trim();
  if (t.startsWith("查天氣 ")) return t.replace("查天氣", "").trim();
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
// LINE Webhook Router
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {
      if (e.message?.type !== "text") continue;
      const text = e.message.text.trim();

      // Tier 1：股票
      if (text.startsWith("股 ") || text.startsWith("查股票")) {
        const id = text.replace("查股票", "").replace("股", "").trim();
        const data = await getStockQuote(id);
        await client.replyMessage(e.replyToken, {
          type:"text",
          text: buildStockText(data)
        });
        continue;
      }

      // Tier 1：天氣
      const city = parseWeather(text);
      if (city !== null) {
        const r = await get36hrWeather(CITY_MAP[city] || "高雄市");
        await client.replyMessage(e.replyToken, {
          type:"text",
          text: buildWeatherFriendText(r)
        });
        continue;
      }

      // Tier 1：待辦
      if (todoCmd.keywords?.some(k => text.startsWith(k))) {
        await todoCmd.handler(client, e);
        continue;
      }

      // Tier 2：高鐵啟動
      if (text === "查高鐵") {
        const hsr = await handleHSR(e);
        if (typeof hsr === "string") {
          await client.replyMessage(e.replyToken, { type:"text", text: hsr });
        }
        continue;
      }

      // Tier 3：高鐵流程
      const hsr = await handleHSR(e);
      if (typeof hsr === "string") {
        await client.replyMessage(e.replyToken, { type:"text", text: hsr });
        continue;
      }
    }
    res.send("OK");
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
