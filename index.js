// ======================================================
// 毛怪秘書 LINE Bot — index.js（修正版）
// 修正項目：
// - 客單價 regex
// - 摘要顯示不完整問題
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ======================================================
const todoCmd = require("./commands/chat/todo");

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
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

const num = v => (v ? Number(v.replace(/,/g, "")) : "");
const toWan = n => (n ? (n / 10000).toFixed(1) : "");

// ======================================================
// 解析（修正版）
// ======================================================
function parse(text) {
  const d = text.match(/(\d{1,2})\/(\d{1,2})/);
  const date = d
    ? `${new Date().getFullYear()}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`
    : "";

  const revenue = text.match(/業績\s*[:：]\s*([\d,]+)/);
  const pkg = text.match(/套餐份數\s*[:：]\s*([\d,]+)/);

  // ✅ 修正：耐空白的客單價
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
    totalPct
  };
}

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
        "", "", "", "", "", p.totalPct
      ]]
    }
  });

  // ✅ 修正版摘要（固定順序、不吃空字串影響）
  const summaryParts = [];
  if (p.date) summaryParts.push(p.date.slice(5));
  summaryParts.push("茶六博愛｜");
  if (p.revenue) summaryParts.push(`業績 ${toWan(p.revenue)} 萬`);
  if (p.pkg) summaryParts.push(`套餐 ${p.pkg}`);
  if (p.unit) summaryParts.push(`客單 ${p.unit}`);
  if (p.totalPct) summaryParts.push(`人事 ${p.totalPct}%`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!Q${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[summaryParts.join(" ")]] }
  });
}

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
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events || []) {
      if (await handlePrivateSales(event)) continue;

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
