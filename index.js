// ======================================================
// 毛怪秘書 LINE Bot — index.js（縣市解析修正版）
// ======================================================

require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

const app = express();
app.use(express.json());

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(config);

// ======================================================
// 預設城市
// ======================================================
const DEFAULT_CITY = process.env.DEFAULT_CITY || "高雄市";

// ======================================================
// 縣市對照表（短名 → 正式名）
// ======================================================
const CITY_MAP = {
  "台北": "台北市",
  "臺北": "台北市",
  "新北": "新北市",
  "桃園": "桃園市",
  "台中": "台中市",
  "臺中": "台中市",
  "台南": "台南市",
  "臺南": "台南市",
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
  "台東": "台東縣",
  "臺東": "台東縣",
  "澎湖": "澎湖縣",
  "金門": "金門縣",
  "連江": "連江縣"
};

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

        const rawText = event.message.text;

        // ==================================================
        // 天氣指令
        // ==================================================
        if (rawText.includes("天氣")) {
          try {
            // ---------- 解析縣市（最穩版本） ----------
            let city = DEFAULT_CITY;

            for (const key of Object.keys(CITY_MAP)) {
              if (rawText.includes(key)) {
                city = CITY_MAP[key];
                break;
              }
            }

            console.log("🌤 WEATHER CITY =", city, "| text =", rawText);

            const weather = await get36hrWeather(city);
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
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書啟動，PORT ${PORT}`);
});
