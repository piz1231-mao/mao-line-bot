// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 重構穩定版 v1.4.4（業績解析定錨版）
//
// 【架構定位】
// ------------------------------------------------------
// - index.js 為「唯一 Router / 裁判」
// - 所有指令先在此判斷，不允許模組互相搶事件
// - 狀態型功能（如高鐵）僅在被指派時啟動
//
// 【功能總覽】
// ------------------------------------------------------
// 即時指令（無狀態，高優先）
// - 📊 股票查詢（單筆）：
//   ・股 2330 / 查股票 3189
//   ・指數 / 期貨：台指期 / 台指 / 櫃買 / OTC / 大盤
//
// - 🛒 股票清單（購物車模式，精簡顯示）：
//   ・查購物車
//   ・查清單
//   ・查股票 購物車
//   （僅顯示：現價 / 漲跌 / 漲跌幅）
//
// - 🌤 天氣查詢：天氣 台中 / 查天氣 雲林
// - 📋 待辦事項：待辦：XXX
// - 📈 查業績：查業績 / 查業績 茶六博愛
// - 🧾 業績回報：大哥您好～（只寫不回，失敗才回）
//
// 狀態型流程（明確起手）
// - 🚄 高鐵查詢：查高鐵 → 北上/南下 → 起訖站 → 時間
//
// 系統功能
// - TradingView Webhook（鎖死）
// - Google Sheet 業績寫入與查詢
//
// 【重要規範】
// ------------------------------------------------------
// ⚠️ 新增功能一律只動 index.js + 新模組
// ⚠️ 不得在狀態機模組內判斷其他指令
// ⚠️ 高鐵模組已完全解耦，不可再加 escape 判斷
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// Services / Handlers
// ======================================================

const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");
const handleHSR = require("./handlers/hsr");
const { buildStockListFlex } = require("./services/stock.list.flex");
const { buildStockSingleFlexMessage } = require("./services/stock.single.flex");

// 股票
const { getStockQuote } = require("./services/stock.service");
const { buildStockText } = require("./services/stock.text");

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
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

const num = v =>
  v !== undefined && v !== null && v !== ""
    ? Number(String(v).replace(/,/g, ""))
    : 0;

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
// 業績解析（定錨版）
// ======================================================
function parseSales(text) {
  // 正規化（⚠️ 關鍵：句號轉空白，避免 NaN）
  const t = text
    .replace(/：/g, ":")
    .replace(/％/g, "%")
    .replace(/。/g, " ")
    .replace(/\(\./g, "(")
    .replace(/（\./g, "(");

  const d = t.match(/(\d{1,2})[\/\-](\d{1,2})/);

  const extract = (key) => {
    const reg = new RegExp(
      `${key}薪資\\s*:\\s*([\\d,]+)[^\\d%]*([\\d.]+)%`
    );
    const m = t.match(reg);
    if (!m) return [0, 0];
    return [num(m[1]), Number(m[2]) || 0];
  };

  const fp = extract("外場");
  const bp = extract("內場");

  return {
    date: d
      ? `${new Date().getFullYear()}-${d[1].padStart(2,"0")}-${d[2].padStart(2,"0")}`
      : "",
    revenue: num(t.match(/(?:業績|總業績)\s*:\s*([\d,]+)/)?.[1]),
    unit: t.match(/客單價\s*:\s*([\d.]+)/)?.[1] || "",
    qty: num(
      t.match(/(?:套餐份數|套餐數|總鍋數)\s*:\s*([\d,]+)/)?.[1]
    ),
    fp,
    bp
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
    requestBody:{
      values:[[
        nowTW(), userId, userId, text,
        shop, p.date, p.revenue, "業績",
        p.qty, p.unit,
        p.fp[0], p.fp[1],
        p.bp[0], p.bp[1],
        p.fp[0] + p.bp[0],
        Number((p.fp[1] + p.bp[1]).toFixed(2))
      ]]
    }
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
// LINE Webhook（Router 主流程）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {
      if (e.message?.type !== "text") continue;
      const text = e.message.text.trim();

      // ===== Tier 1：即時指令 =====

      // 股票 / 指數 / 期貨（市場自動判斷）
if (
  text.startsWith("股 ") ||
  text.startsWith("查股票 ") ||
  ["台指期","台指","櫃買","OTC","大盤"].includes(text)
) {
  const id =
    ["台指期","台指","櫃買","OTC","大盤"].includes(text)
      ? text
      : text.replace("查股票", "").replace("股", "").trim();

  const data = await getStockQuote(id);
const flex = buildStockSingleFlexMessage(data);
await client.replyMessage(e.replyToken, flex);
  continue;
}
      
      // ===== 📋 購物車 / 清單 =====
if (
  text === "查購物車" ||
  text === "查清單" ||
  text === "查股票 購物車"
) {
  try {
    const c = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: c });

    // 讀取「購物車」分頁 A 欄
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "購物車!A:A"
    });

    const symbols = (r.data.values || [])
      .map(v => v[0])
      .filter(Boolean);

    if (!symbols.length) {
      await client.replyMessage(e.replyToken, {
        type: "text",
        text: "📋 我的購物車\n━━━━━━━━━━━\n\n（清單是空的）"
      });
      continue;
    }

    // 逐一查價（走你已定版的 stock.service）
    const results = [];
    for (const s of symbols) {
      const data = await getStockQuote(s);
      if (data) results.push(data);
    }

    const flex = buildStockListFlex(results);

await client.replyMessage(e.replyToken, flex);
  } catch (err) {
    console.error("❌ 查購物車失敗:", err);
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "⚠️ 查購物車失敗"
    });
  }
  continue;
}

      // 天氣
      const city = parseWeather(text);
      if (city !== null) {
        const r = await get36hrWeather(CITY_MAP[city] || "高雄市");
        await client.replyMessage(e.replyToken, {
          type:"text",
          text: buildWeatherFriendText(r)
        });
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
          const r = await sheets.spreadsheets.values.get({
            spreadsheetId:SPREADSHEET_ID,
            range:`${s}!Q:Q`
          });
          const list = r.data.values?.map(v=>v[0]).filter(Boolean) || [];
          if (list.length) out.push(list.at(-1));
        }
        await client.replyMessage(e.replyToken, {
          type:"text",
          text: out.length ? out.join("\n\n━━━━━━━━━━━\n\n") : "目前沒有資料"
        });
        continue;
      }

      // ===== 業績回報（只寫不回）=====
      if (text.startsWith("大哥您好")) {
        const shop =
          text.includes("湯棧") ? "湯棧中山"
          : text.includes("三山") ? "三山博愛"
          : "茶六博愛";
        try {
          await ensureSheet(shop);
          await writeShop(shop, text, e.source.userId);
        } catch (err) {
          console.error("❌ 業績回報失敗:", err);
          await client.replyMessage(e.replyToken, {
            type:"text",
            text:"⚠️ 業績回報失敗"
          });
        }
        continue;
      }

      // ===== Tier 2 / 3：高鐵 =====
      const hsrResult = await handleHSR(e);
      if (typeof hsrResult === "string") {
        await client.replyMessage(e.replyToken, {
          type:"text",
          text: hsrResult
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
// 排程接口（保留）
// ======================================================
app.post("/api/daily-summary", async (req, res) => {
  res.send("ok");
});

// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
