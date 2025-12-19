// ======================================================
// 毛怪秘書 LINE Bot — index.js（天氣穩定版）
// ======================================================

require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

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
// 預設城市
// ======================================================
const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";

// ======================================================
// 支援縣市清單
// ======================================================
const CITY_LIST = [
  "台北市","新北市","桃園市","台中市","台南市","高雄市",
  "基隆市","新竹市","新竹縣","苗栗縣","彰化縣","南投縣",
  "雲林縣","嘉義市","嘉義縣","屏東縣","宜蘭縣","花蓮縣",
  "台東縣","澎湖縣","金門縣","連江縣"
];

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

        const rawText = event.message.text.trim();
        const clean = rawText.replace(/\s/g, "");

        // ==================================================
        // 天氣指令
        // ==================================================
        if (clean.includes("天氣")) {
          try {
            // ---------- 解析縣市 ----------
            let city = DEFAULT_CITY;

            for (const c of CITY_LIST) {
              const short = c.replace("市","").replace("縣","");
              if (rawText.includes(c) || rawText.includes(short)) {
                city = c;
                break;
              }
            }

            console.log("🌤 WEATHER CITY =", city);

            // ---------- 查天氣 ----------
            const weather = await get36hrWeather(city);

            // ---------- 產生毛怪文案 ----------
            const text = buildWeatherFriendText(weather);

            await client.replyMessage(event.replyToken, {
              type: "text",
              text
            });

          } catch (err) {
            console.error("🌧 WEATHER ERROR:", err);

            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "天氣資料現在有點怪，等等再試。"
            });
          }

          continue;
        }

        // ==================================================
        // 其他訊息（暫時忽略）
        // ==================================================
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
  console.log(`🚀 毛怪秘書啟動，PORT ${PORT}`);
});
