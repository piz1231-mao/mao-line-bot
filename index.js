// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 基準定版 v1.2（功能鎖死）
// - TradingView Webhook（鎖死）
// - 天氣查詢（縣市完整）
// - 待辦功能
// - 私訊營運回報（三店分頁）
// - 摘要寫入 Q 欄（emoji 版）
// - 查業績：單店 / 三店合併（A 分隔線）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// 原有 services（⚠️ 不動）
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
const SHOP_LIST = ["茶六博愛", "三山博愛", "湯棧中山"];

const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// TradingView Webhook（✅ 補回，原樣鎖死）
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

const num = v => (v ? Number(String(v).replace(/,/g, "")) : "");
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
  "花蓮": "花蓮縣",
  "台東": "臺東縣", "臺東": "臺東縣",
  "澎湖": "澎湖縣", "金門": "金門縣",
  "連江": "連江縣"
};

// ======================================================
// 正規化 / 解析
// ======================================================
function normalize(text) {
  return text
    .replace(/：/g, ":")
    .replace(/。/g, ".")
    .replace(/％/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSales(text) {
  const t = normalize(text);

  const d = t.match(/(\d{1,2})\/(\d{1,2})/);
  const date = d
    ? `${new Date().getFullYear()}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`
    : "";

  const revenue = t.match(/業績[:：]?\s*([\d,]+)/);
  const unit = t.match(/客單價[:：]?\s*([\d.]+)/);
  const qty =
    t.match(/套餐份數[:：]?\s*([\d,]+)/) ||
    t.match(/總鍋數[:：]?\s*([\d,]+)/);

  const fp = t.match(/外場薪資[:：]?\s*([\d,]+).([\d.]+)%/);
  const bp = t.match(/內場薪資[:：]?\s*([\d,]+).([\d.]+)%/);

  const frontPay = fp ? num(fp[1]) : "";
  const frontPct = fp ? pct(fp[2]) : "";
  const backPay = bp ? num(bp[1]) : "";
  const backPct = bp ? pct(bp[2]) : "";

  return {
    date,
    revenue: revenue ? num(revenue[1]) : "",
    unit: unit ? unit[1] : "",
    qty: qty ? num(qty[1]) : "",
    frontPay,
    frontPct,
    backPay,
    backPct,
    totalPay: frontPay && backPay ? frontPay + backPay : "",
    totalPct: frontPct && backPct ? Number((frontPct + backPct).toFixed(2)) : ""
  };
}

// ======================================================
// 確保分店 Sheet 存在
// ======================================================
async function ensureSheet(shop) {
  if (shop === TEMPLATE_SHEET) return;

  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

  if (meta.data.sheets.some(s => s.properties.title === shop)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: shop } } }] }
  });

  const header = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TEMPLATE_SHEET}!A1:Q1`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!A1:Q1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: header.data.values }
  });
}

// ======================================================
// 寫入分店（唯一寫入點）
// ======================================================
async function writeShop(shop, text, userId) {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!A:A`
  });
  const row = (meta.data.values?.length || 1) + 1;

  const p = parseSales(text);
  const qtyLabel = shop === "湯棧中山" ? "總鍋數" : "套餐數";

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        nowTW(), userId, userId, text,
        shop, p.date, p.revenue, "業績",
        p.qty, p.unit,
        p.frontPay, p.frontPct,
        p.backPay, p.backPct,
        p.totalPay, p.totalPct
      ]]
    }
  });

  const summary =
`【${shop}｜${p.date.slice(5)}】

💰 業績：${p.revenue}

📦 ${qtyLabel}：${p.qty}
🧾 客單價：${p.unit || "XXXX"}

👥 人事
外場：${p.frontPay}（${p.frontPct}%）
內場：${p.backPay}（${p.backPct}%）
總計：${p.totalPay}（${p.totalPct}%）`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!Q${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[summary]] }
  });
}

// ======================================================
// 私訊營運回報
// ======================================================
async function handlePrivateSales(event) {
  if (event.type !== "message") return false;
  if (event.source.type !== "user") return false;
  if (event.message.type !== "text") return false;

  const text = event.message.text.trim();
  if (!text.startsWith("大哥您好")) return false;

  const shop =
    text.includes("湯棧中山") ? "湯棧中山" :
    text.includes("三山博愛") ? "三山博愛" :
    "茶六博愛";

  await ensureSheet(shop);
  await writeShop(shop, text, event.source.userId);

  await client.replyMessage(event.replyToken, { type: "text", text: "已記錄" });
  return true;
}

// ======================================================
// 查詢（單店 / 三店合併）
// ======================================================
async function handleQuery(event) {
  if (event.message.type !== "text") return false;
  if (!event.message.text.startsWith("查業績")) return false;

  const parts = event.message.text.trim().split(/\s+/);
  const shopArg = parts[1];

  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  if (shopArg && SHOP_LIST.includes(shopArg)) {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${shopArg}!Q:Q`
    });
    const list = r.data.values?.map(v => v[0]).filter(Boolean) || [];
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: list.length ? list[list.length - 1] : "目前沒有資料"
    });
    return true;
  }

  let combined = [];
  for (const shop of SHOP_LIST) {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${shop}!Q:Q`
    });
    const list = r.data.values?.map(v => v[0]).filter(Boolean) || [];
    if (list.length) combined.push(list[list.length - 1]);
  }

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: combined.length
      ? combined.join("\n\n━━━━━━━━━━━━━━\n\n")
      : "目前沒有資料"
  });
  return true;
}

// ======================================================
// LINE Webhook（主入口）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events || []) {
      if (await handlePrivateSales(event)) continue;
      if (await handleQuery(event)) continue;

      if (event.message?.type === "text") {
        if (todoCmd.keywords?.some(k => event.message.text.startsWith(k))) {
          await todoCmd.handler(client, event);
          continue;
        }

        const parsed = parseCommand(event.message.text);
        if (parsed?.command === "WEATHER") {
          const city = CITY_MAP[parsed.arg] || "高雄市";
          const r = await get36hrWeather(city);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: buildWeatherFriendText(r)
          });
        }
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
  console.log(`🚀 毛怪秘書服務啟動，PORT ${PORT}`);
});
