// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.2（穩定功能鎖死）
// A-3 茶六博愛｜營運解析 v1
// B-1 摘要欄位（v1 emoji）
// B-2 查詢指令
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
// 自家 services（原有）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");

// ======================================================
// LINE 設定（原有）
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
// Google Sheet 設定（原有）
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
// 工具
// ======================================================
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

const num = v => (v ? Number(v.replace(/,/g, "")) : "");
const pct = v => (v ? Number(v) : "");

// ======================================================
// 天氣（完整原版，不刪）
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
// 解析（A-3，原樣）
// ======================================================
function parse(text) {
  const d = text.match(/(\d{1,2})\/(\d{1,2})/);
  const date = d
    ? `${new Date().getFullYear()}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`
    : "";

  const revenue = text.match(/業績\s*[:：]\s*([\d,]+)/);
  const pkg = text.match(/套餐份數\s*[:：]\s*([\d,]+)/);
  const unit = text.match(/客單價\s*[:：]\s*([\d.]+)/);

  const fp = text.match(/外場薪資\s*([\d,]+)。([\d.]+)%/);
  const bp = text.match(/內場薪資\s*([\d,]+)。([\d.]+)%/);
  const tp = text.match(/總人事\s*[:：]\s*([\d,]+)。([\d.]+)%/);

  let frontPay = fp ? num(fp[1]) : "";
  let frontPct = fp ? pct(fp[2]) : "";
  let backPay = bp ? num(bp[1]) : "";
  let backPct = bp ? pct(bp[2]) : "";

  let totalPay = tp ? num(tp[1]) : "";
  let totalPct = tp ? pct(tp[2]) : "";

  if (!totalPay && frontPay && backPay) totalPay = frontPay + backPay;
  if (!totalPct && frontPct && backPct)
    totalPct = Number((frontPct + backPct).toFixed(2));

  return {
    date,
    revenue: revenue ? num(revenue[1]) : "",
    pkg: pkg ? num(pkg[1]) : "",
    unit: unit ? unit[1] : "",
    frontPay,
    frontPct,
    backPay,
    backPct,
    totalPay,
    totalPct
  };
}

// ======================================================
// 核心寫入（唯一寫入點，原樣）
// ======================================================
async function appendSalesRow(rawText, userId) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`
  });
  const rowIndex = (meta.data.values?.length || 1) + 1;

  const p = parse(rawText);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        nowTW(), userId, userId, rawText,
        "茶六博愛",
        p.date,
        p.revenue,
        "業績",
        p.pkg,
        p.unit,
        p.frontPay,
        p.frontPct,
        p.backPay,
        p.backPct,
        p.totalPay,
        p.totalPct
      ]]
    }
  });

  // ===== B-1：摘要（v1 emoji）=====
  const summary =
`【茶六博愛｜${p.date.slice(5)}】

💰 業績：${p.revenue}

🧾 客單價：${p.unit || "XXXX"}
📦 套餐數：${p.pkg}

👥 人事
外場：${p.frontPay}（${p.frontPct}%）
內場：${p.backPay}（${p.backPct}%）
總計：${p.totalPay}（${p.totalPct}%）`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!Q${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[summary]] }
  });
}

// ======================================================
// 私訊業績回報
// ======================================================
async function handlePrivateSales(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  await appendSalesRow(text, event.source.userId);

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "已記錄"
  });
  return true;
}

// ======================================================
// 查詢（只讀摘要 Q）
// ======================================================
async function handleQuery(event) {
  if (event.message.type !== "text") return false;
  if (!event.message.text.startsWith("查業績")) return false;

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!Q:Q`
  });

  const list = res.data.values?.map(v => v[0]).filter(Boolean) || [];
  if (!list.length) {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "目前沒有資料"
    });
    return true;
  }

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: list[list.length - 1]
  });
  return true;
}

// ======================================================
// LINE Webhook（完整保留）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
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
        const city =
          CITY_MAP[parsed.arg] || process.env.DEFAULT_CITY || "高雄市";
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
});

// ======================================================
// 主動推播：每日老闆摘要（給 Render Cron 用）
// ======================================================
app.post("/api/daily-summary", async (req, res) => {
  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    // 讀 Q 欄（摘要）
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!Q:Q`
    });

    const list = result.data.values?.map(v => v[0]).filter(Boolean) || [];

    if (!list.length) {
      return res.status(200).send("no data");
    }

    const latestSummary = list[list.length - 1];

    // 主動推播（push）
    await client.pushMessage(process.env.BOSS_USER_ID, {
      type: "text",
      text: latestSummary
    });

    res.status(200).send("ok");
  } catch (err) {
    console.error("❌ daily-summary error:", err);
    res.status(500).send("error");
  }
});

// ======================================================
// 啟動 Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
