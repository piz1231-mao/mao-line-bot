// ======================================================
// 毛怪秘書 LINE Bot — index.js（線上正式版 v1.1）
// 功能：
// - TradingView 訊號接收
// - Yahoo 台指期查詢
// - 天氣查詢（預設城市 / 城市在前後皆可）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
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
// TradingView Webhook（維持原本用途）
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

  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*"
    },
    timeout: 5000
  });

  const q = res.data.quoteResponse.result[0];
  if (!q) throw new Error("No TXF data");

  return {
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePct: q.regularMarketChangePercent,
    time: new Date(q.regularMarketTime * 1000).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };
}

// ======================================================
// 指令解析（混合模式）
// ======================================================
function parseCommand(text) {
  if (!text) return null;
  const t = text.trim();

  // 精準模式（冒號）
  if (t.includes("：")) {
    const [cmd, arg = ""] = t.split("：");
    return { command: cmd.trim(), arg: arg.trim() };
  }

  // 人性模式（句首）
  const keywordMap = {
    WEATHER: ["天氣", "查天氣", "看天氣"],
    TXF: ["台指期", "查台指", "看台指"]
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
// LINE Webhook
// ======================================================
app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    try {
      for (const event of req.body.events || []) {
        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const parsed = parseCommand(event.message.text);
        if (!parsed) continue;

        // ===== 台指期 =====
        if (parsed.command === "台指期" || parsed.command === "TXF") {
          const txf = await getTXF();
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `【台指期即時】
目前：${txf.price}
漲跌：${txf.change > 0 ? "▲" : "▼"}${txf.change.toFixed(0)}（${txf.changePct.toFixed(2)}%）
時間：${txf.time}`
          });
          continue;
        }

        // ===== 天氣 =====
        if (parsed.command === "天氣" || parsed.command === "WEATHER") {
          const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";
          let city = parsed.arg && parsed.arg.trim();

          // 1) 沒帶城市 → 用預設
          if (!city) {
            city = DEFAULT_CITY;
          }

          // 2) 支援「台中天氣 / 高雄天氣」
          if (!parsed.arg) {
            const CITY_KEYS = [
              "台北","臺北","新北","桃園","台中","臺中","台南","臺南","高雄",
              "基隆","新竹","苗栗","彰化","南投","雲林","嘉義","屏東",
              "宜蘭","花蓮","台東","臺東","澎湖","金門","連江"
            ];

            for (const k of CITY_KEYS) {
              if (event.message.text.includes(k)) {
                city = k
                  .replace("臺", "台")
                  .endsWith("市") || k.endsWith("縣")
                  ? k.replace("臺", "台")
                  : k.replace("臺", "台") + "市";
                break;
              }
            }
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
