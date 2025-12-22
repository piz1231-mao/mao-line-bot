// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 線上正式版 v1.2 + 私訊測試 + chat 指令修復版
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
// 自家 services
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

// ======================================================
// commands/chat（原本的待辦、help 都在這）
// ======================================================
const helpCmd = require("./commands/chat/help");
const idCmd = require("./commands/chat/id");
const interviewCmd = require("./commands/chat/interview");
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
// 指令解析（天氣 / 台指期）
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
// 城市正規化表
// ======================================================
const CITY_MAP = {
  "台北": "臺北市",
  "臺北": "臺北市",
  "台中": "臺中市",
  "臺中": "臺中市",
  "高雄": "高雄市",
  "彰化": "彰化縣"
};

// ======================================================
// ⭐ chat 指令安全執行器（關鍵修復）
// 支援：
// - module.exports = function
// - module.exports = { execute() }
// - module.exports = { run() }
// ======================================================
async function runChatCommand(cmd, event, client) {
  if (!cmd) return false;

  if (typeof cmd === "function") {
    await cmd(event, client);
    return true;
  }

  if (typeof cmd.execute === "function") {
    await cmd.execute(event, client);
    return true;
  }

  if (typeof cmd.run === "function") {
    await cmd.run(event, client);
    return true;
  }

  return false;
}

// ======================================================
// 🧪 私訊測試｜業績回報（第一階段）
// ======================================================
async function handlePrivateSalesTest(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  console.log("🧪【私訊測試】命中業績回報");
  console.log(text);

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
        // 🧪 私訊測試（最高優先，不影響其他功能）
        // --------------------------------------------------
        const handled = await handlePrivateSalesTest(event);
        if (handled) continue;

        // --------------------------------------------------
        // chat 指令（help / id / interview / todo）
        // --------------------------------------------------
        if (await runChatCommand(helpCmd, event, client)) continue;
        if (await runChatCommand(idCmd, event, client)) continue;
        if (await runChatCommand(interviewCmd, event, client)) continue;
        if (await runChatCommand(todoCmd, event, client)) continue;

        // --------------------------------------------------
        // 天氣 / 台指期（你原本的）
        // --------------------------------------------------
        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const parsed = parseCommand(event.message.text);
        if (!parsed) continue;

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
// 啟動 Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
