// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.2（穩定功能鎖死）＋
// A-3 茶六博愛｜營運解析 v1（已完成）＋
// B-1 摘要欄位 ＋ B-2 查詢指令
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
// 舊有穩定功能（不動）
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
// 工具：數字格式
// ======================================================
function toWan(n) {
  if (!n) return "";
  return (n / 10000).toFixed(1);
}

// ======================================================
// B-1：產生摘要並寫入 Q 欄
// ======================================================
async function buildAndWriteSummary(rowIndex) {
  const clientAuth = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: clientAuth });

  const range = `${SHEET_NAME}!A${rowIndex}:Q${rowIndex}`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });

  const row = res.data.values?.[0];
  if (!row) return;

  const date = row[5] || "";
  const revenue = row[6] ? `${toWan(row[6])} 萬` : "";
  const packages = row[8] ? `套餐 ${row[8]}` : "";
  const unitPrice = row[9] ? `客單 ${row[9]}` : "";
  const totalPct = row[15] ? `人事 ${row[15]}%` : "";

  const summary = [
    date?.slice(5),
    "茶六博愛｜",
    revenue,
    packages,
    unitPrice,
    totalPct
  ].filter(Boolean).join(" ");

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!Q${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[summary]]
    }
  });
}

// ======================================================
// 私訊業績回報（完成後補摘要）
// ======================================================
async function handlePrivateSales(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  const clientAuth = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: clientAuth });

  // 取得目前最後一列
  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`
  });

  const nextRow = (meta.data.values?.length || 1) + 1;

  // 🔁 呼叫你已存在的 A-3 寫入流程（直接 append）
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
        event.source.userId,
        event.source.userId,
        text,
        "茶六博愛", "", "", "業績",
        "", "", "", "", "", "", "", ""
      ]]
    }
  });

  // 🔧 補摘要
  await buildAndWriteSummary(nextRow);

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "已記錄"
  });

  return true;
}

// ======================================================
// B-2：查詢指令（只讀摘要）
// ======================================================
async function handleQuery(event) {
  if (event.message.type !== "text") return false;
  const text = event.message.text.trim();

  if (!text.startsWith("查業績")) return false;

  const args = text.split(" ");
  const dateArg = args[2]; // 可能有日期

  const clientAuth = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: clientAuth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!Q:Q`
  });

  const summaries = res.data.values?.map(v => v[0]).filter(Boolean) || [];
  if (!summaries.length) {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前沒有資料"
    });
    return true;
  }

  let target = summaries[summaries.length - 1];
  if (dateArg) {
    const found = summaries.find(s => s.includes(dateArg));
    if (found) target = found;
  }

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: `【茶六博愛】\n${target}`
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
        if (await handleQuery(event)) continue;

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
