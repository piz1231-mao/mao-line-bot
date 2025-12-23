// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 功能：
// - 業績私訊回報（大哥您好）
// - A～P 完整寫入（不破壞既有）
// - Q 欄「數字版老闆摘要」（定版）
// - 查詢只讀摘要
// - 待辦 / 天氣 / TV Webhook 保留
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
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
const client = new line.Client(config);

// ======================================================
// 舊功能（保留）
// ======================================================
const todoCmd = require("./commands/chat/todo");
const tvAlert = require("./services/tvAlert");
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

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
// 工具
// ======================================================
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

const num = v => (v ? Number(v.replace(/,/g, "")) : "");

// ======================================================
// 解析（A-3，保留）
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
  let frontPct = fp ? Number(fp[2]) : "";
  let backPay = bp ? num(bp[1]) : "";
  let backPct = bp ? Number(bp[2]) : "";

  let totalPay = tp ? num(tp[1]) : "";
  let totalPct = tp ? Number(tp[2]) : "";

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
// 核心寫入（唯一寫入點）
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

  // A～P 寫入
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        nowTW(),            // A
        userId,             // B
        userId,             // C
        rawText,            // D
        "茶六博愛",         // E
        p.date,             // F
        p.revenue,          // G
        "業績",             // H
        p.pkg,              // I
        p.unit,             // J
        p.frontPay,         // K
        p.frontPct,         // L
        p.backPay,          // M
        p.backPct,          // N
        p.totalPay,         // O
        p.totalPct          // P
      ]]
    }
  });

  // ======================================================
  // Q 欄：數字版老闆摘要（定版）
  // ======================================================
  const summary =
    `茶六博愛 ${p.date?.slice(5)}｜` +
    `業績 ${p.revenue}｜` +
    `人事 外 ${p.frontPay}（${p.frontPct}%） / ` +
    `內 ${p.backPay}（${p.backPct}%） / ` +
    `總 ${p.totalPay}（${p.totalPct}%）｜` +
    `${p.pkg} 套`;

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
// 查詢（只讀摘要）
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
    text: `【茶六博愛｜最新】\n${list[list.length - 1]}`
  });
  return true;
}

// ======================================================
// LINE Webhook
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events || []) {
      if (await handlePrivateSales(event)) continue;
      if (await handleQuery(event)) continue;

      if (
        event.type === "message" &&
        event.message.type === "text" &&
        todoCmd.keywords?.some(k => event.message.text.startsWith(k))
      ) {
        await todoCmd.handler(client, event);
      }
    }
    res.status(200).send("OK");
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
