// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 線上正式版 v1.2（穩定功能鎖死）＋
// 私訊測試（大哥您好）＋
// 待辦功能（依 commands/chat/todo.js 設計）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");

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
// chat 指令模組（只接，不改內部）
// ======================================================
const todoCmd = require("./commands/chat/todo");

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
// 指令解析（天氣｜舊有行為保留）
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
// 城市正規化表（🔥 完整版，鎖死不再動）
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
// 🧪 私訊測試（業績回報第一階段）
// 條件：1 對 1 私訊 + 開頭「大哥您好」
// ======================================================
async function handlePrivateSalesTest(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  if (!event.message.text.startsWith("大哥您好")) return false;

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "收到（私訊測試中）"
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

        // --------------------------------------------------
        // ① 私訊測試（只吃「大哥您好」，不影響其他）
        // --------------------------------------------------
        if (await handlePrivateSalesTest(event)) continue;

        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const text = event.message.text.trim();

        // --------------------------------------------------
        // ② 待辦（依 todo.js 設計：keywords + handler）
        // --------------------------------------------------
        if (
          todoCmd.keywords &&
          todoCmd.keywords.some(k => text.startsWith(k))
        ) {
          await todoCmd.handler(client, event);
          continue;
        }

        // --------------------------------------------------
        // ③ 天氣（舊有穩定功能，行為不變）
        // --------------------------------------------------
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
