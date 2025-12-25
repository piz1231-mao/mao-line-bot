// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 穩定整合版 v1.3.4（高鐵 / 股票 / 天氣 / 待辦 / 查業績 全通）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// Services / Handlers（全部既有，不刪）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const { getStockQuote } = require("./services/stock.service");
const { buildStockText } = require("./services/stock.text");
const todoCmd = require("./commands/chat/todo");
const handleHSR = require("./handlers/hsr");

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
// Google Sheet 設定
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHOP_LIST = ["茶六博愛", "三山博愛", "湯棧中山"];

const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// 工具
// ======================================================
const CITY_MAP = {
  台北:"臺北市",臺北:"臺北市",新北:"新北市",桃園:"桃園市",
  台中:"臺中市",臺中:"臺中市",台南:"臺南市",臺南:"臺南市",
  高雄:"高雄市",基隆:"基隆市",新竹:"新竹市",苗栗:"苗栗縣",
  彰化:"彰化縣",南投:"南投縣",雲林:"雲林縣",嘉義:"嘉義市",
  屏東:"屏東縣",宜蘭:"宜蘭縣",花蓮:"花蓮縣",
  台東:"臺東縣",臺東:"臺東縣",澎湖:"澎湖縣",
  金門:"金門縣",連江:"連江縣"
};

function parseWeather(text) {
  if (!text) return null;
  const t = text.trim();
  if (t === "天氣" || t.startsWith("天氣 ")) {
    return t.replace("天氣", "").trim();
  }
  return null;
}

// ======================================================
// LINE Webhook
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {
      if (e.type !== "message" || e.message.type !== "text") continue;

      const text = e.message.text.trim();

      // ==================================================
      // 🚄 高鐵（狀態機）
      // ==================================================
      const hsrResult = await handleHSR(e);
      if (hsrResult) {
        if (typeof hsrResult === "string") {
          await client.replyMessage(e.replyToken, {
            type: "text",
            text: hsrResult
          });
        }
        continue;
      }

      // ==================================================
      // 📊 股票查詢
      // ==================================================
      if (text.startsWith("股 ")) {
        const stockId = text.replace("股", "").trim();
        const data = await getStockQuote(stockId);
        await client.replyMessage(e.replyToken, {
          type: "text",
          text: buildStockText(data)
        });
        continue;
      }

      // ==================================================
      // 📈 查業績（✅ 補回）
      // ==================================================
      if (text.startsWith("查業績")) {
        const arg = text.split(" ")[1];
        const c = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth: c });

        let out = [];

        for (const shop of SHOP_LIST) {
          if (arg && shop !== arg) continue;

          const r = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${shop}!Q:Q`
          });

          const list = r.data.values
            ?.map(v => v[0])
            .filter(Boolean) || [];

          if (list.length) out.push(list.at(-1));
        }

        await client.replyMessage(e.replyToken, {
          type: "text",
          text: out.length
            ? out.join("\n\n━━━━━━━━━━━\n\n")
            : "目前沒有資料"
        });
        continue;
      }

      // ==================================================
      // 📋 待辦
      // ==================================================
      if (todoCmd.keywords?.some(k => text.startsWith(k))) {
        await todoCmd.handler(client, e);
        continue;
      }

      // ==================================================
      // 🌤 天氣
      // ==================================================
      const city = parseWeather(text);
      if (city !== null) {
        const r = await get36hrWeather(CITY_MAP[city] || "高雄市");
        await client.replyMessage(e.replyToken, {
          type: "text",
          text: buildWeatherFriendText(r)
        });
        continue;
      }
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
