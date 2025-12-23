// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 穩定基準 v1.2（功能鎖死）
// 查詢規則：
// - 查業績           → 三店合併（摘要原樣）
// - 查業績 店名      → 單店摘要
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// 原有 services（完全不動）
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
// 正規化
// ======================================================
function normalizeText(text) {
  return text
    .replace(/：/g, ":")
    .replace(/。/g, ".")
    .replace(/％/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

// ======================================================
// parse（共用）
// ======================================================
function parseBase(text) {
  const t = normalizeText(text);

  const d = t.match(/(\d{1,2})\/(\d{1,2})/);
  const date = d
    ? `${new Date().getFullYear()}-${d[1].padStart(2, "0")}-${d[2].padStart(2, "0")}`
    : "";

  const revenue = t.match(/業績\s*[:：]?\s*([\d,]+)/);
  const unit = t.match(/客單價\s*[:：]?\s*([\d.]+)/);

  const fp = t.match(/外場薪資\s*[:：]?\s*([\d,]+).([\d.]+)%/);
  const bp = t.match(/內場薪資\s*[:：]?\s*([\d,]+).([\d.]+)%/);

  let frontPay = fp ? num(fp[1]) : "";
  let frontPct = fp ? pct(fp[2]) : "";
  let backPay = bp ? num(bp[1]) : "";
  let backPct = bp ? pct(bp[2]) : "";

  return {
    date,
    revenue: revenue ? num(revenue[1]) : "",
    unit: unit ? unit[1] : "",
    frontPay,
    frontPct,
    backPay,
    backPct,
    totalPay: frontPay && backPay ? frontPay + backPay : "",
    totalPct: frontPct && backPct ? Number((frontPct + backPct).toFixed(2)) : ""
  };
}

// ======================================================
// 分店 parse
// ======================================================
function parseShop(raw) {
  const t = normalizeText(raw);
  const base = parseBase(t);

  const qty =
    t.match(/套餐份數\s*[:：]?\s*([\d,]+)/) ||
    t.match(/總鍋數\s*[:：]?\s*([\d,]+)/);

  return {
    ...base,
    pkg: qty ? num(qty[1]) : ""
  };
}

// ======================================================
// 確保分店 sheet 存在
// ======================================================
async function ensureShopSheetExists(shop) {
  if (shop === TEMPLATE_SHEET) return;

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

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
async function writeShopRow(shop, text, userId) {
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!A:A`
  });
  const rowIndex = (meta.data.values?.length || 1) + 1;

  const p = parseShop(text);
  const qtyLabel = shop === "湯棧中山" ? "總鍋數" : "套餐數";

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        nowTW(), userId, userId, text,
        shop,
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

  const summary =
`【${shop}｜${p.date.slice(5)}】

💰 業績：${p.revenue}

📦 ${qtyLabel}：${p.pkg}
🧾 客單價：${p.unit || "XXXX"}

👥 人事
外場：${p.frontPay}（${p.frontPct}%）
內場：${p.backPay}（${p.backPct}%）
總計：${p.totalPay}（${p.totalPct}%）
`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!Q${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[summary]] }
  });
}

// ======================================================
// 私訊回報
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

  await ensureShopSheetExists(shop);
  await writeShopRow(shop, text, event.source.userId);

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

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: authClient });

  // 指定店名
  if (shopArg && SHOP_LIST.includes(shopArg)) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${shopArg}!Q:Q`
    });
    const list = res.data.values?.map(v => v[0]).filter(Boolean) || [];
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: list.length ? list[list.length - 1] : "目前沒有資料"
    });
    return true;
  }

  // 未指定 → 三店合併
  let combined = [];
  for (const shop of SHOP_LIST) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${shop}!Q:Q`
    });
    const list = res.data.values?.map(v => v[0]).filter(Boolean) || [];
    if (list.length) combined.push(list[list.length - 1]);
  }

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: combined.length ? combined.join("\n\n") : "目前沒有資料"
  });
  return true;
}

// ======================================================
// Webhook
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
