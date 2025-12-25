// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 穩定定版 v1.5.0
//
// 【架構定位】
// ------------------------------------------------------
// - index.js = 唯一 Router（裁判）
// - 僅負責「指令判斷與分流」
// - 不做資料解析、不做爬蟲
//
// 【功能總覽】
// ------------------------------------------------------
// Tier 1｜即時指令（無狀態）
// - 📊 個股查詢（官方 API）
//   - 股 2330 / 查股票 3105
// - 📈 指數查詢（官方）
//   - 大盤 / 加權（TWSE）
//   - 櫃買 / OTC（TPEX）
// - 📉 台指期（期貨）
//   - 台指 / 台指期（Yahoo，僅此）
// - 🌤 天氣查詢
// - 📋 待辦事項
// - 📊 查業績
// - 🧾 業績回報（大哥您好｜成功不回覆，失敗才回）
//
// Tier 2 / 3｜狀態型流程
// - 🚄 高鐵查詢（handleHSR 全權負責）
//
// 系統功能
// - TradingView Webhook
// - Google Sheet 寫入 / 摘要
//
// 【重要原則】
// ------------------------------------------------------
// ⚠️ 個股 ≠ 指數 ≠ 期貨（嚴格分流）
// ⚠️ Yahoo 只用在「台指期」
// ⚠️ 不得在 service 裡判斷指令
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// Services
// ======================================================
const { getStockQuote } = require("./services/stock.service");   // 個股（官方）
const { getIndexQuote } = require("./services/index.service");   // 指數（官方）
const { getFutureQuote } = require("./services/future.service"); // 台指期（Yahoo）

const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");
const handleHSR = require("./handlers/hsr");

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ======================================================
// Google Sheet 設定（業績）
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
// TradingView Webhook（鎖死）
// ======================================================
app.all("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let body = {};
    if (typeof req.body === "string") {
      try { body = JSON.parse(req.body); } catch {}
    }
    const msg = body.message || body.alert || req.body;
    await tvAlert(client, msg, body);
    res.send("OK");
  } catch (err) {
    console.error("❌ TV Webhook Error:", err);
    res.send("OK");
  }
});

// ======================================================
// 工具
// ======================================================
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

const num = v => (v ? Number(String(v).replace(/,/g, "")) : 0);

// ======================================================
// 天氣解析
// ======================================================
function parseWeather(text) {
  const t = text.trim();
  if (t === "天氣" || t.startsWith("天氣 ")) return t.replace("天氣", "").trim();
  if (t.startsWith("查天氣 ")) return t.replace("查天氣", "").trim();
  return null;
}

const CITY_MAP = {
  台北:"臺北市",臺北:"臺北市",新北:"新北市",桃園:"桃園市",
  台中:"臺中市",臺中:"臺中市",台南:"臺南市",臺南:"臺南市",
  高雄:"高雄市",基隆:"基隆市",新竹:"新竹市",苗栗:"苗栗縣",
  彰化:"彰化縣",南投:"南投縣",雲林:"雲林縣",嘉義:"嘉義市",
  屏東:"屏東縣",宜蘭:"宜蘭縣",花蓮:"花蓮縣",
  台東:"臺東縣",臺東:"臺東縣",澎湖:"澎湖縣",
  金門:"金門縣",連江:"連江縣"
};

// ======================================================
// 解析業績（定版）
// ======================================================
function parseSales(text) {
  const t = text
    .replace(/：/g, ":")
    .replace(/％/g, "%")
    .replace(/。/g, " ")
    .replace(/\(\./g, "(")
    .replace(/（\./g, "(");

  const d = t.match(/(\d{1,2})[\/\-](\d{1,2})/);

  const extract = (key) => {
    const reg = new RegExp(`${key}薪資\\s*:\\s*([\\d,]+)[^\\d%]*([\\d.]+)%`);
    const m = t.match(reg);
    if (!m) return [0, 0];
    return [num(m[1]), Number(m[2]) || 0];
  };

  return {
    date: d ? `${new Date().getFullYear()}-${d[1].padStart(2,"0")}-${d[2].padStart(2,"0")}` : "",
    revenue: num(t.match(/(?:業績|總業績)\s*:\s*([\d,]+)/)?.[1]),
    unit: t.match(/客單價\s*:\s*([\d.]+)/)?.[1] || "",
    qty: num(t.match(/(?:套餐份數|套餐數|總鍋數)\s*:\s*([\d,]+)/)?.[1]),
    fp: extract("外場"),
    bp: extract("內場")
  };
}

// ======================================================
// Sheet 操作
// ======================================================
async function ensureSheet(shop) {
  if (shop === TEMPLATE_SHEET) return;
  const c = await auth.getClient();
  const sheets = google.sheets({ version:"v4", auth:c });
  const meta = await sheets.spreadsheets.get({ spreadsheetId:SPREADSHEET_ID });
  if (meta.data.sheets.some(s => s.properties.title === shop)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId:SPREADSHEET_ID,
    requestBody:{ requests:[{ addSheet:{ properties:{ title:shop } } }] }
  });

  const header = await sheets.spreadsheets.values.get({
    spreadsheetId:SPREADSHEET_ID,
    range:`${TEMPLATE_SHEET}!A1:Q1`
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId:SPREADSHEET_ID,
    range:`${shop}!A1:Q1`,
    valueInputOption:"USER_ENTERED",
    requestBody:{ values:header.data.values }
  });
}

async function writeShop(shop, text, userId) {
  const c = await auth.getClient();
  const sheets = google.sheets({ version:"v4", auth:c });
  const p = parseSales(text);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId:SPREADSHEET_ID,
    range:`${shop}!A1`,
    valueInputOption:"USER_ENTERED",
    requestBody:{ values:[[
      nowTW(), userId, userId, text,
      shop, p.date, p.revenue, "業績",
      p.qty, p.unit,
      p.fp[0], p.fp[1],
      p.bp[0], p.bp[1],
      p.fp[0] + p.bp[0],
      Number((p.fp[1] + p.bp[1]).toFixed(2))
    ]]}
  });

  const row = res.data.updates.updatedRange.match(/\d+/)[0];
  const qtyLabel = shop === "湯棧中山" ? "總鍋數" : "套餐數";

  const summary =
`【${shop}｜${p.date.slice(5)}】

💰 業績：${p.revenue}

📦 ${qtyLabel}：${p.qty}
🧾 客單價：${p.unit}

👥 人事
外場：${p.fp[0]}（${p.fp[1]}%）
內場：${p.bp[0]}（${p.bp[1]}%）
總計：${p.fp[0] + p.bp[0]}（${Number((p.fp[1] + p.bp[1]).toFixed(2))}%）`;

  await sheets.spreadsheets.values.update({
    spreadsheetId:SPREADSHEET_ID,
    range:`${shop}!Q${row}`,
    valueInputOption:"USER_ENTERED",
    requestBody:{ values:[[summary]] }
  });
}

// ======================================================
// LINE Webhook（Router）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {
      if (e.message?.type !== "text") continue;
      const text = e.message.text.trim();
      const upper = text.toUpperCase();

      // ===== Tier 1：即時指令 =====

      // 個股（官方）
      if (text.startsWith("股 ") || text.startsWith("查股票 ")) {
        const id = text.replace("查股票", "").replace("股", "").trim();
        const data = await getStockQuote(id);
        await client.replyMessage(e.replyToken, { type:"text", text:data });
        continue;
      }

      // 指數（官方）
      if (["大盤","加權"].includes(text)) {
        const data = await getIndexQuote("TWSE");
        await client.replyMessage(e.replyToken, { type:"text", text:data });
        continue;
      }

      if (["櫃買","OTC"].includes(upper)) {
        const data = await getIndexQuote("TPEX");
        await client.replyMessage(e.replyToken, { type:"text", text:data });
        continue;
      }

      // 台指期（Yahoo）
      if (["台指","台指期"].includes(text)) {
        const data = await getFutureQuote();
        await client.replyMessage(e.replyToken, { type:"text", text:data });
        continue;
      }

      // 天氣
      const city = parseWeather(text);
      if (city !== null) {
        const r = await get36hrWeather(CITY_MAP[city] || "高雄市");
        await client.replyMessage(e.replyToken, { type:"text", text:buildWeatherFriendText(r) });
        continue;
      }

      // 待辦
      if (todoCmd.keywords?.some(k => text.startsWith(k))) {
        await todoCmd.handler(client, e);
        continue;
      }

      // 查業績
      if (text.startsWith("查業績")) {
        const arg = text.split(" ")[1];
        const c = await auth.getClient();
        const sheets = google.sheets({ version:"v4", auth:c });
        let out = [];
        for (const s of SHOP_LIST) {
          if (arg && s !== arg) continue;
          const r = await sheets.spreadsheets.values.get({ spreadsheetId:SPREADSHEET_ID, range:`${s}!Q:Q` });
          const list = r.data.values?.map(v=>v[0]).filter(Boolean) || [];
          if (list.length) out.push(list.at(-1));
        }
        await client.replyMessage(e.replyToken,{
          type:"text",
          text: out.length ? out.join("\n\n━━━━━━━━━━━\n\n") : "目前沒有資料"
        });
        continue;
      }

      // 業績回報（成功不回，失敗才回）
      if (text.startsWith("大哥您好")) {
        const shop = text.includes("湯棧") ? "湯棧中山" :
                     text.includes("三山") ? "三山博愛" : "茶六博愛";
        try {
          await ensureSheet(shop);
          await writeShop(shop, text, e.source.userId);
        } catch (err) {
          console.error(err);
          await client.replyMessage(e.replyToken,{ type:"text", text:"⚠️ 業績回報失敗" });
        }
        continue;
      }

      // ===== Tier 2 / 3：高鐵 =====
      const hsr = await handleHSR(e);
      if (typeof hsr === "string") {
        await client.replyMessage(e.replyToken,{ type:"text", text:hsr });
        continue;
      }
    }
    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

app.post("/api/daily-summary", async (_, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`)
);
