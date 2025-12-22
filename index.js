// ======================================================
// 毛怪秘書 LINE Bot — index.js（線上正式版 v1.2 + 私訊測試）
// 功能：
// - TradingView 訊號接收
// - Yahoo 台指期查詢
// - 天氣查詢（天氣 / 天氣 台中 / 天氣 彰化）
// - 🧪 私訊測試：1 對 1 +「大哥您好」
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");

const app = express();

// ======================================================
// 自家 services
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

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
// 台指期查詢（Yahoo Finance）
// ======================================================
async function getTXF() {
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=TXF=F";

  const res = await axios.get(url, { timeout: 5000 });
  const q = res.data.quoteResponse.result[0];
  if (!q) throw new Error("No TXF data");

  return {
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePct: q.regularMarketChangePercent
  };
}

// ======================================================
// 指令解析（你原本的，不動）
// ======================================================
function parseCommand(text) {
  if (!text) return null;
  const t = text.trim();

  const keywordMap = {
    WEATHER: ["天氣"],
    TXF: ["台指期"]
  };

  for (const [type, keys] of Object.entries(keywordMap)) {
    for (const k of keys) {
      if (t === k || t.startsWith(k + " ")) {
        return { command: type, arg: t.slice(k.length).trim() };
      }
    }
  }
  return null;
}

// ======================================================
// 城市正規化表（🔥 關鍵）
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
// LINE Webhook（⚠️ 只加私訊測試，不破壞原功能）
// ======================================================
app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    try {
      for (const event of req.body.events || []) {

        // --------------------------------------------------
        // 🧪 私訊測試攔截（加法，不影響原本功能）
        // --------------------------------------------------
        const handled = await handlePrivateSalesTest(event);
        if (handled) continue;

        // --------------------------------------------------
        // 原本已存在的邏輯（完全不動）
        // --------------------------------------------------
        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const parsed = parseCommand(event.message.text);
        if (!parsed) continue;

        // ===== 天氣 =====
        if (parsed.command === "WEATHER") {
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
// 🧪 私訊測試｜業績回報（第一階段）
// 條件：
// - 1 對 1 私訊
// - 文字訊息
// - 開頭是「大哥您好」
// ======================================================
async function handlePrivateSalesTest(event) {

  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();

  if (!text.startsWith("大哥您好")) return false;

  console.log("🧪【私訊測試】命中業績回報");
  console.log(text);

  // 測試階段才回一句
  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "收到（私訊測試中）"
  });

  return true;
}

// ======================================================
// 啟動 Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
