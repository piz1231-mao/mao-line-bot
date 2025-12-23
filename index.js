// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 穩定基準 v1.2（功能鎖死）
// 茶六博愛為範本，分店獨立寫入
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
// 原有 services（不動）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");

// ======================================================
// LINE 設定（不動）
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
// Google Sheet 設定
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const TEMPLATE_SHEET = "茶六博愛";

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
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

const num = v => (v ? Number(String(v).replace(/,/g, "")) : "");
const pct = v => (v ? Number(v) : "");

// ======================================================
// 天氣（原版，不動）
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
// 文字正規化（只洗字）
// ======================================================
function normalizeText(text) {
  return text
    .replace(/：/g, ":")
    .replace(/。/g, ".")
    .replace(/％/g, "%")
    .replace(/／/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// 原 parse（茶六用，不動）
// ======================================================
function parse(text) {
  const d = text.match(/(\d{1,2})\/(\d{1,2})/);
  const date = d
    ? `${new Date().getFullYear()}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`
    : "";

  const revenue = text.match(/業績[:：]?\s*([\d,]+)/);
  const pkg = text.match(/套餐份數[:：]?\s*([\d,]+)/);
  const unit = text.match(/客單價[:：]?\s*([\d.]+)/);

  const fp = text.match(/外場薪資[:：]?\s*([\d,]+).([\d.]+)%/);
  const bp = text.match(/內場薪資[:：]?\s*([\d,]+).([\d.]+)%/);
  const tp = text.match(/總人事[:：]?\s*([\d,]+).([\d.]+)%/);

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
// 分店專用 parse（已定版）
// ======================================================
function parseShop(raw) {
  const text = normalizeText(raw);
  const base = parse(text);

  // ① 套餐份數（茶六 / 三山）
  if (!base.pkg) {
    const pkg = text.match(/套餐份數[:：]?\s*([\d,]+)/);
    if (pkg) base.pkg = num(pkg[1]);
  }

  // ② 總鍋數（湯棧）
  if (!base.pkg) {
    const pot = text.match(/總鍋數[:：]?\s*([\d,]+)/);
    if (pot) base.pkg = num(pot[1]);
  }

  // ③ 舊格式備援（不主用）
  if (!base.pkg) {
    const matches = [...text.matchAll(/(\d+)\s*人套餐[:：]?\s*(\d+)/g)];
    if (matches.length) {
      base.pkg = matches.reduce((sum, m) => sum + Number(m[2]), 0);
    }
  }

  return base;
}

// ======================================================
// 分店 Sheet 建立（複製茶六）
// ======================================================
async function ensureShopSheetExists(shopName) {
  if (shopName === TEMPLATE_SHEET) return;

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === shopName);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: shopName } } }]
    }
  });

  const header = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TEMPLATE_SHEET}!A1:Q1`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shopName}!A1:Q1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: header.data.values }
  });
}

// ======================================================
// 分店寫入
// ======================================================
async function appendSalesRowByShop(shopName, rawText, userId) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shopName}!A:A`
  });
  const rowIndex = (meta.data.values?.length || 1) + 1;

  const p = parseShop(rawText);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shopName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        nowTW(), userId, userId, rawText,
        shopName,
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

  const qtyLabel = shopName === "湯棧中山" ? "總鍋數" : "套餐數";

  const summary =
`【${shopName}｜${p.date.slice(5)}】

💰 業績：${p.revenue}

📦 ${qtyLabel}：${p.pkg}
🧾 客單價：${p.unit || "XXXX"}

👥 人事
外場：${p.frontPay}（${p.frontPct}%）
內場：${p.backPay}（${p.backPct}%）
總計：${p.totalPay}（${p.totalPct}%）`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shopName}!Q${rowIndex}`,
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

  const shop =
    text.includes("三山博愛") ? "三山博愛" :
    text.includes("湯棧中山") ? "湯棧中山" :
    "茶六博愛";

  await ensureShopSheetExists(shop);
  await appendSalesRowByShop(shop, text, event.source.userId);

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: "已記錄"
  });

  return true;
}

// ======================================================
// LINE Webhook（其餘功能不動）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events || []) {
      if (await handlePrivateSales(event)) continue;

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
// 啟動
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
