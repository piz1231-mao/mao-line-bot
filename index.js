// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 穩定定版 v1.7.3
// （資金水位查詢整合｜功能說明校正｜權限邊界確認）
//
// 【架構定位（定版，不再調整）】
// ------------------------------------------------------
// - index.js 為「唯一 Router / 裁判」
// - 所有 LINE 訊息只在此檔判斷是否為指令
// - service / handler 僅負責單一職責，不搶流程
// - 狀態型功能必須「明確啟動」，不可自動誤判
// - AI / 翻譯 / 圖片功能遵守「不誤判、不打架」原則
//
// ======================================================
// 【功能總覽（依目前實際程式行為）】
// ======================================================
//
// 【Tier 1｜即時指令（無狀態）】
// ------------------------------------------------------
// - 📊 股票查詢
//   ・股 2330 / 查股票 3189
//   ・台指期 / 台指 / 櫃買 / OTC / 大盤
//
// - 🛒 股票購物車
//   ・查購物車 / 查清單 / 查股票 購物車
//
// - 🌤 天氣查詢
//   ・天氣 台中 / 查天氣 高雄
//
// - 📘 文字翻譯（需明確指令）
//   ・翻譯 中文 → 英文（忠實翻譯）
//   ・翻譯 外文 → 台灣中文代筆
//
// - 📘 今日英文
//   ・每日隨機 10 組單字 / 片語
//   ・包含：中文、拼音、台式唸法、KK 音標、例句
//   ・instance 層防重複機制（recentEnglishPool）
//
// - 💰 銀行資金水位查詢（GAS）
//   ・查資金 / 查銀行資金 / 查銀行資金水位
//   ・由 Google Apps Script Web App 回傳 Flex JSON
//   ・Router 僅負責轉發，不解析、不加工內容
//
// ------------------------------------------------------
//
// 【Tier 2｜狀態型流程（一次性）】
// ------------------------------------------------------
// - 🖼 圖片翻譯
//   ・輸入「翻譯圖片」後進入靜默等待
//   ・僅翻譯該次圖片，不自動誤判
//   ・完成後自動清除狀態
//
// - 🚄 高鐵查詢
//   ・多步驟狀態機（方向 → 起訖 → 時間）
//   ・流程未結束前，不受關鍵字防火牆影響
//
// ------------------------------------------------------
//
// 【Tier 3｜營運 / 系統層（鎖定）】
// ------------------------------------------------------
// - 🧾 業績回報（只寫不回，寫入 Google Sheet）
// - 📈 業績查詢（單店 / 全店）
// - 📊 每日營運總覽（08:00 主動推播）
//   ・C1：三店營運摘要
//   ・C2：各店銷售佔比
// - 🚨 TradingView Webhook（最高優先權｜隔離處理）
//
// ======================================================
// 【翻譯 / 圖片處理原則（定版）】
// ======================================================
// - 翻譯結果以「台灣人實際會用的內容」為準
// - 禁止簡體字、中國用語、翻譯腔
// - JSON 僅作為內部解析，不對使用者顯示
// - 不顯示 mode / 結構 / prompt 痕跡
// - 圖片翻譯需明確指令，不主動觸發
//
// ======================================================
// 【v1.7.3 版本優化備註（本次改版重點）】
// ======================================================
// - 新增：銀行資金水位查詢功能（GAS Web App）
//   ・僅接受「查資金」相關明確指令
//   ・避免一般聊天誤觸查詢
//
// - 確認：GAS Web App 存取權限需設為「任何人」
//   ・避免 Node fetch 取得 Google 登入頁（HTML）
//   ・避免 JSON parse error
//
// - 校正：功能說明與實際程式行為完全對齊
//   ・無架構變更
//   ・無 Router 流程調整
//   ・屬穩定補充版本
//
// ======================================================

require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

// ======================================================
// 📘 今日英文｜記憶體防重複（instance 層）
// ======================================================
const recentEnglishPool = new Set();
const MAX_RECENT = 40; // 記住最近用過的單字數量

// ======================================================
// 🖼 圖片翻譯狀態（一次性）
// ======================================================
const imageTranslateSessions = new Set();

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
const { buildStockSingleFlex } = require("./services/stock.single.flex");

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
const UTILITIES_SPREADSHEET_ID = "15BuvMH32ETU7-v8Ql3aRFpuQnyf244zdbOdOOiXNi4w";
const TEMPLATE_SHEET = "茶六博愛";
const SHOP_LIST = ["茶六博愛", "三山博愛", "湯棧中山"];

// ======================================================
// Google Auth（Render / 本機通用｜定版｜v1.6.6 防呆修正）
// ======================================================
function getGoogleAuth() {
  // ✅ Render / 雲端（base64）
  if (process.env.GOOGLE_CREDENTIALS_B64) {
    let json = Buffer
      .from(process.env.GOOGLE_CREDENTIALS_B64, "base64")
      .toString("utf8");

    // 🛡️ 防呆機制：如果解碼出來還是 Base64 (以 "ewog" 開頭)，再解一次
    if (json.trim().startsWith("ewog")) {
      console.log("⚠️ 偵測到雙重 Base64 編碼，嘗試二次解碼...");
      json = Buffer.from(json, "base64").toString("utf8");
    }

    return new GoogleAuth({
      credentials: JSON.parse(json),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
  }

  // ✅ 本機開發（只有你電腦才會用到）
  return new GoogleAuth({
    keyFile: "./google-credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

const auth = getGoogleAuth();

// ======================================================
// TradingView Webhook（⚡最高優先權｜隔離抗噪優化版）
// ======================================================
app.all("/tv-alert", express.text({ type: "*/*" }), (req, res) => {
  // ⭐ 1️⃣ 立刻回 OK，先保命
  res.status(200).send("OK");

  // ⭐ 2️⃣ 丟到背景處理，不阻塞 event loop
  setImmediate(async () => {
    try {
      let body = {};
      if (typeof req.body === "string") {
        try { body = JSON.parse(req.body); } catch {}
      }

      const msg = body.message || body.alert || req.body;

      console.log(`🚨 [SIGNAL] ${nowTW()} 收到 TV 訊號`);

      await tvAlert(client, msg, body);

      console.log("✅ TV 推播成功");
    } catch (err) {
      console.error("❌ TV Webhook Error:", err);
    }
  });
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
function detectShop(text) {
  if (text.includes("茶六博愛")) return "茶六博愛";
  if (text.includes("三山博愛")) return "三山博愛";
  if (text.includes("湯棧中山")) return "湯棧中山";
  return null;
}

// ======================================================
// 茶六套餐解析器（v1.4 定版｜符號容錯）
// ======================================================
function parseTea6Combos(text) {
  const t = text.replace(/：/g, ":").replace(/％/g, "%");

  const items = [
    "極品豚肉套餐", "豐禾豚肉套餐", "特級牛肉套餐", "上等牛肉套餐",
    "真饌和牛套餐", "極炙牛肉套餐", "日本和牛套餐",
    "三人豚肉套餐", "三人極上套餐", "御。和牛賞套餐", "初和炙炙套餐"
  ];

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const result = {};

  for (const name of items) {
    const searchPattern = escapeRegExp(name).replace(/。/g, ".?");
    const reg = new RegExp(
      `${searchPattern}\\s*[:：]?\\s*(\\d+)\\s*套[^\\d%]*([\\d.]+)%`
    );
    const m = t.match(reg);
    result[name] = m
      ? { qty: Number(m[1]), ratio: Number(m[2]) }
      : { qty: 0, ratio: 0 };
  }
  return result;
}

function parseSanshanCombos(text) {
  const t = text.replace(/：/g, ":").replace(/％/g, "%");
  const fields = SHOP_RATIO_FIELDS["三山博愛"];
  const result = {};
  for (const name of fields) {
    const reg = new RegExp(
      `${name}\\s*[:：]?\\s*(\\d+)\\s*(?:套)?[^\\d%]*([\\d.]+)%`
    );
    const m = t.match(reg);
    result[name] = m
      ? { qty: Number(m[1]), ratio: Number(m[2]) }
      : { qty: 0, ratio: 0 };
  }
  return result;
}

function parseTangzhanCombos(text) {
  const t = text.replace(/：/g, ":").replace(/％/g, "%");
  const fields = SHOP_RATIO_FIELDS["湯棧中山"];
  const result = {};
  for (const name of fields) {
    const reg = new RegExp(
      `${name}\\s*[:：]?\\s*(?:(\\d+)[^\\d%]*)?(?:([\\d.]+)%)*`
    );
    const m = t.match(reg);
    result[name] = m
      ? {
          qty: m[1] ? Number(m[1]) : 0,
          ratio: m[2] ? Number(m[2]) : 0
        }
      : { qty: 0, ratio: 0 };
  }
  return result;
}
// ======================================================
// 水 / 電 / 瓦斯 解析器（STEP 1）
// ======================================================
function parseUtilities(text) {
  const t = text.replace(/：/g, ":");

  const gas   = t.match(/瓦斯(?:度數)?\s*:\s*([\d.]+)/)?.[1] || "";
  const power = t.match(/電(?:度數)?\s*:\s*([\d.]+)/)?.[1] || "";
  const water = t.match(/水(?:度數)?\s*:\s*([\d.]+)/)?.[1] || "";

  return {
    gas,
    power,
    water
  };
}
// ======================================================
// ⏱ 時段業績解析器（STEP 2）
// ======================================================
function parseTimeSales(text) {
  const t = text.replace(/：/g, ":").replace(/。/g, ".");

  const patterns = [
    { type: "早上餐期",  reg: /早上餐期\s*(\d{1,2}-\d{1,2})\.(\d+)/ },
    { type: "早上離峰",  reg: /早上離峰\s*(\d{1,2}-\d{1,2})\.(\d+)/ },
    { type: "早上業績",  reg: /早上業績\s*(\d{1,2}-\d{1,2})\.(\d+)/ },
    { type: "晚上餐期",  reg: /晚上餐期\s*(\d{1,2}-\d{1,2})\.(\d+)/ },
    { type: "晚上離峰",  reg: /晚上離峰\s*(\d{1,2}-\d{1,2})\.(\d+)/ },
    { type: "晚上業績",  reg: /晚上業績\s*(\d{1,2}-\d{1,2})\.(\d+)/ }
  ];

  const result = [];

  for (const p of patterns) {
    const m = t.match(p.reg);
    if (m) {
      result.push({
        type: p.type,
        time: m[1],
        amount: Number(m[2])
      });
    }
  }

  return result;
}

// ======================================================
// 通用：各店套餐 / 鍋型佔比寫入（R 欄）
// ======================================================
async function writeShopRatios({ shop, row, comboMap }) {
  if (!auth) return;
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });
  const fields = SHOP_RATIO_FIELDS[shop];
  if (!fields) return;

  const values = [];
  for (const name of fields) {
    const item = comboMap[name] || { qty: 0, ratio: 0 };
    values.push(item.qty);
    values.push(item.ratio);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!R${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}
// ======================================================
// 三表登記（寫入水 / 電 / 瓦斯）
// ======================================================
async function writeUtilities({ shop, date, text, userId }) {
  if (!auth) return;

  const { gas, power, water } = parseUtilities(text);

  // 如果三個都沒有，就不要寫
  if (!gas && !power && !water) return;

  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  await sheets.spreadsheets.values.append({
    spreadsheetId: UTILITIES_SPREADSHEET_ID,
    range: `三表登記!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
   values: [[
  nowTW(),   // 系統時間（保留）
  userId,
  shop,
  date,      // ⭐ 唯一營運日期來源
  water || "",
  power || "",
  gas || "",
  text       // ⭐ 原始訊息一定要留
]]
    }
  });
}
// ======================================================
// ⏱ 時段業績寫入（STEP 2）
// ======================================================
async function writeTimeSales({ shop, date, text, userId }) {
  if (!auth) return;

  const items = parseTimeSales(text);
  if (!items.length) return;

  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const values = items.map(i => ([
    nowTW(),      // 系統時間
    userId,
    shop,
    date,         // ⭐ 共用營運日期
    i.type,       // 早上餐期 / 晚上業績
    i.time,       // 11-15
    i.amount,     // 金額
    text          // 原始訊息（一定要留）
  ]));

  await sheets.spreadsheets.values.append({
    spreadsheetId: UTILITIES_SPREADSHEET_ID,
    range: "時段業績!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });
}

// ======================================================
// Sheet 操作（定版）
// ======================================================
async function ensureSheet(shop) {
  if (!auth || shop === TEMPLATE_SHEET) return;
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

async function writeShop(shop, text, userId) {
  if (!auth) return;
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });
  const p = parseSales(text);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
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

  const row = Number(res.data.updates.updatedRange.match(/\d+/)[0]);
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
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!Q${row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[summary]] }
  });

  return row;
}

// ======================================================
// 各店銷售佔比欄位定版（⚠️ 不可亂動）
// ======================================================
const SHOP_RATIO_FIELDS = {
  "茶六博愛": [
    "極品豚肉套餐","豐禾豚肉套餐","特級牛肉套餐","上等牛肉套餐",
    "真饌和牛套餐","極炙牛肉套餐","日本和牛套餐",
    "三人豚肉套餐","三人極上套餐","御。和牛賞套餐","初和炙炙套餐"
  ],
  "三山博愛": [
    "豬&豬套餐","頂級豬豬套餐","美國牛肉套餐","美澳牛肉套餐",
    "日美澳牛肉套餐","美日和牛套餐","日本A5和牛套餐","頂級日本A5和牛套餐",
    "三人豬&豬套餐","三人頂級豬豬套餐","三人美國牛肉套餐","三人日美澳牛肉套餐",
    "聖誕特獻雙人套餐"
  ],
  "湯棧中山": [
    "麻油鍋","燒酒鍋","剝皮辣椒鍋","魷魚螺肉蒜鍋","昆布鍋","蔬食鍋","麻油、燒酒鍋",
    "冷藏嫩肩豬肉","冷藏豬腹肉","冷藏頂級嫩肩豬肉",
    "冷藏極上牛腹肉","冷藏去骨牛小排","冷藏肉比例",
    "聖誕海陸雙饌套餐"
  ]
};

// ======================================================
// ✅ 共用｜每日營運報表引擎（C1 + C2｜已定版）
// ======================================================
async function buildDailyReportCarousel({ date, shops }) {
  const bubbles = [];
  bubbles.push(
    buildDailySummaryFlex({ date, shops }).contents
  );
  for (const s of SHOP_LIST) {
    const bubble = await readShopRatioBubble({ shop: s, date });
    if (bubble) bubbles.push(bubble);
  }
  return {
    type: "flex",
    altText: `每日營運總覽 ${date}`,
    contents: {
      type: "carousel",
      contents: bubbles
    }
  };
}

// ======================================================
// C1｜三店總覽 Flex
// ======================================================
function buildDailySummaryFlex({ date, shops }) {
  return {
    type: "flex",
    altText: `每日營運總覽 ${date}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "lg",
        contents: [
          {
            type: "text",
            text: `📊 每日營運總覽｜${date}`,
            weight: "bold",
            size: "xl"
          },
          ...shops.flatMap((shop, idx) => {
            const overLimit =
              (shop.name === "茶六博愛" && shop.hrTotalRate > 22) ||
              (shop.name !== "茶六博愛" && shop.hrTotalRate > 25);

            const qtyEmoji = shop.name === "湯棧中山" ? "🍲" : "🍱";
            const qtyLabel = shop.name === "湯棧中山" ? "總鍋數" : "套餐數";

            const block = [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: shop.name,
                    weight: "bold",
                    size: "lg"
                  },
                  {
                    type: "text",
                    text: `💵 業績：${shop.revenue.toLocaleString()}`,
                    size: "md",
                    weight: "bold"
                  },
                  {
                    type: "text",
                    text: `${qtyEmoji} ${qtyLabel}：${shop.qty}`,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `🧾 客單價：${shop.unit}`,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `👥 外場：${shop.fp.toLocaleString()}（${shop.fpRate}%）`,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `👥 內場：${shop.bp.toLocaleString()}（${shop.bpRate}%）`,
                    size: "md"
                  },
                  {
                    type: "text",
                    text: `👥 總人事：${shop.hrTotal.toLocaleString()}（${shop.hrTotalRate}%）`,
                    size: "md",
                    weight: "bold",
                    color: overLimit ? "#D32F2F" : "#333333"
                  }
                ]
              }
            ];
            if (idx < shops.length - 1) {
              block.push({ type: "separator", margin: "lg" });
            }
            return block;
          })
        ]
      }
    }
  };
}

// ======================================================
// C2-1 單店銷售佔比 Bubble
// ======================================================
function buildShopRatioBubble({ shop, date, items }) {
  const contents = [];
  const headerEmoji = shop === "湯棧中山" ? "🍲" : "🍱";

  contents.push({
    type: "text",
    text: `${headerEmoji} ${shop}｜銷售佔比`,
    weight: "bold",
    size: "xl"
  });

  contents.push({
    type: "text",
    text: date,
    size: "sm",
    color: "#888888",
    margin: "md"
  });

  let hotRank = 0;
  let coldRank = 0;
  let coldSectionStarted = false;

  items.forEach(item => {
    const isOilMix    = item.name === "麻油、燒酒鍋";
    const isColdRatio = item.name === "冷藏肉比例";
    const isColdItem  = item.name.includes("冷藏");

    let rankIndex = null;
    if (!isOilMix && !isColdRatio) {
      if (!isColdItem) {
        rankIndex = hotRank;
        hotRank++;
      } else {
        rankIndex = coldRank;
        coldRank++;
      }
    }

    const isTop1 = rankIndex === 0;
    const isTop2 = rankIndex === 1;
    const isTop3 = rankIndex === 2;

    const rankColor =
      isTop1 ? "#D32F2F" :
      isTop2 ? "#F57C00" :
      isTop3 ? "#FBC02D" :
      "#333333";

    const nameWeight = (isOilMix || isColdRatio || isTop1 || isTop2 || isTop3) ? "bold" : "regular";

    if (!coldSectionStarted && isColdItem) {
      contents.push({ type: "separator", margin: "xl" });
      coldSectionStarted = true;
    }

    contents.push({
      type: "box",
      layout: "horizontal",
      margin: (isOilMix || isColdRatio) ? "xl" : "md",
      contents: [
        {
          type: "text",
          text: item.name,
          flex: 5,
          size: "md",
          wrap: true,
          weight: nameWeight,
          color: rankColor
        },
        {
          type: "text",
          text: `${item.qty}`,
          flex: 2,
          size: "md",
          align: "end",
          weight: (isOilMix || isColdRatio) ? "bold" : "regular"
        },
        {
          type: "text",
          text: item.ratio !== undefined && item.ratio !== "" ? `${item.ratio}%` : "",
          flex: 3,
          size: "md",
          align: "end",
          weight: (isOilMix || isColdRatio) ? "bold" : "regular"
        }
      ]
    });
  });

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents
    }
  };
}

function isMostlyChinese(text) {
  const chineseChars = text.match(/[\u4e00-\u9fff]/g) || [];
  return chineseChars.length / text.length > 0.4;
}

// ======================================================
// 🤖 OpenAI 共用呼叫器（集中管理｜安全版｜唯一入口）
// ======================================================
async function callOpenAIChat({
  systemPrompt = "",
  userPrompt,
  temperature = 0.3,
  model = "gpt-4o-mini"
}) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userPrompt });

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model, messages, temperature })
    });
  } catch (err) {
    console.error("❌ OpenAI fetch failed:", err);
    throw new Error("OpenAI fetch failed");
  }

  if (!response || !response.ok) {
    console.error("❌ OpenAI API response not OK");
    throw new Error("OpenAI API response not OK");
  }

  const data = await response.json();
  if (!data.choices || !data.choices.length) {
    console.error("❌ OpenAI response malformed:", data);
    throw new Error("OpenAI response malformed");
  }
  return data.choices[0].message.content;
}

// ======================================================
// ✅ 安全解析 JSON（支援 Object / Array｜v1.6.9 定版）
// ======================================================
function safeParseJSON(raw) {
  if (!raw) return null;

  // 1️⃣ 移除 markdown code block
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // 2️⃣ 嘗試抓「最後一段 JSON」（物件或陣列）
  const jsonMatch =
    cleaned.match(/(\{[\s\S]*\})\s*$/) ||   // {}
    cleaned.match(/(\[[\s\S]*\])\s*$/);     // []

  if (!jsonMatch) {
    console.error("❌ JSON not found in response:", cleaned);
    return null;
  }

  try {
    return JSON.parse(jsonMatch[1]);
  } catch (err) {
    console.error("❌ JSON parse failed:", jsonMatch[1]);
    return null;
  }
}

const TAIWAN_REWRITE_SYSTEM_PROMPT = `
你不是翻譯工具。你不是在「整理內容」，也不是在「說明翻譯結果」。

你的任務只有一個：
把圖片中的文字，直接改寫成「可直接使用的繁體中文內容」。

【角色定位】
你是台灣人會直接使用、直接轉寄、直接貼出去的代筆者，
語氣可以像朋友，但內容要清楚、自然、不官腔。

【最高原則（不可違反）】
1. 請使用台灣常用的繁體中文
2. 絕對禁止簡體字、中國用語、翻譯腔
3. 不需要逐句翻譯，可自由重寫、拆句、合併
4. 只要照原文翻會怪，就直接改寫
5. 輸出的文字，看起來必須像是原本就用中文寫的
6. 禁止出現任何說明性語句，例如：
   - 整理後的內容如下
   - 以下為翻譯結果
   - 本文說明
7. 禁止使用任何分隔符號（---、——、===）
8. 不要加標題、不加前言、不加結語

【內容類型提示】
- 一般說明：白話、好讀
- 菜單：台灣餐廳實際會用的菜名，不照字翻

【專有名詞在地化】
- pre-settlement → 交屋前
- settlement / handover → 交屋
- rectification → 修繕 / 改善
- body corporate → 管委會

【輸出要求】
- 請直接輸出「整理後、可直接使用的完整中文內容」
- 不要解釋、不加註解
- 不要提到翻譯、規則、模式
`;

// ======================================================
// 🍽 菜單專用 System Prompt（只給圖片翻譯用）
// ======================================================
const MENU_VISION_SYSTEM_PROMPT = `
你是一個圖片內容分析器。

任務只有三件事：
1. 辨識圖片中的所有可讀文字
2. 判斷圖片是否為「菜單」
3. 依照規則回傳 JSON（不可加任何說明）

【菜單判斷】
- 有多個品項 + 價格 → menu_high
- 菜單但模糊 → menu_low
- 其他（信件、公告、截圖）→ text

【輸出規則】
- 必須回傳 JSON
- items 不得為空
- mode=text 時，items[0].translation 只能放「原始可辨識文字整理結果」
- 不要代筆、不重寫、不美化

【JSON 格式】
{
  "mode": "menu_high | menu_low | text",
  "items": [
    {
      "name": "",
      "price": "",
      "translation": ""
    }
  ]
}
`;
// ======================================================
// 🧹 翻譯輸出總清潔器（防止 JSON / mode / content 外洩｜v1.7.2 優化版）
// ======================================================
function sanitizeTranslationOutput(text) {
  if (!text || typeof text !== "string") return "";

  return text
    // 移除 markdown code block
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    // 移除說明性贅詞
    .replace(/整理後的內容如下[:：]?/gi, "")
    .replace(/^-{3,}$/gm, "")
    .trim();
}

// ======================================================
// 🧠 共用｜台灣代筆核心（文字 / 圖片 共用）
// ======================================================
async function rewriteToTaiwanese({
  content,
  temperature = 0.2
}) {
  if (!content || !content.trim()) return "";

  try {
    return await callOpenAIChat({
      systemPrompt: TAIWAN_REWRITE_SYSTEM_PROMPT, // ✅ v1.7.2 修正拼字錯誤
      userPrompt: content,
      temperature
    });
  } catch (err) {
    console.error("❌ rewriteToTaiwanese error:", err);
    return "";
  }
}
// ======================================================
// 🧠 判斷是否需要再走一次台灣代筆
// ======================================================
function shouldRewriteToTaiwanese(text) {
  if (!text || typeof text !== "string") return false;

  const t = text.trim();

  // 太短的不用重寫
  if (t.length < 20) return false;

  // 已經是繁體中文比例高，就不用再寫
  const chineseRatio = (t.match(/[\u4e00-\u9fff]/g) || []).length / t.length;
  if (chineseRatio > 0.6) return false;

  // 明顯是英文 / 日文 / 韓文 → 需要代筆
  if (/[a-zA-Z]/.test(t)) return true;          // 英文
  if (/[\u3040-\u30ff]/.test(t)) return true;   // 日文假名
  if (/[\uac00-\ud7af]/.test(t)) return true;   // 韓文

  return false;
}

// ======================================================
// 🤖 文字翻譯（台灣代筆｜共用核心版）
// ======================================================
async function translateText(text) {
  const rewritten = await rewriteToTaiwanese({
    content: text,
    temperature: 0.2
  });

  return rewritten || "⚠️ 翻譯失敗，請稍後再試";
}

// ======================================================
// 🍽 菜單文字輕量潤飾器（只修用語，不重翻）
// ======================================================
function polishMenuTranslation(text) {
  if (!text || typeof text !== "string") return "";

  let t = text;

  // 份量用語修正
  t = t.replace(/餃子\s*2個/g, "餃子兩份");
  t = t.replace(/餃子\s*1個/g, "餃子一份");

  // 湯的說法
  t = t.replace(/湯/g, "一碗湯");

  // 補「包含」語感（如果本來就有就不動）
  if (!/包含/.test(t)) {
    t = t.replace(/^(.+?)（/, "$1（包含");
  }

  // 清掉多餘句點
  t = t.replace(/。$/g, "");

  return t.trim();
}
// ======================================================
// 🌐 中文 → 英文翻譯（保留原意，不做台灣代筆）
// ======================================================
async function translateChineseToEnglish(text) {
  if (!text || !text.trim()) return "";

  const systemPrompt = `
You are a professional translator.
Translate the given text into natural, fluent English.

Rules:
- Do NOT explain
- Do NOT add comments
- Do NOT rewrite creatively
- Keep the original meaning
- Output English only
`;

  try {
    return await callOpenAIChat({
      systemPrompt,
      userPrompt: text,
      temperature: 0.2
    });
  } catch (err) {
    console.error("❌ translateChineseToEnglish error:", err);
    return "";
  }
}

// ======================================================
// 🤖 每日英文產生器（隨機主題＋防重複定版）
// ======================================================
async function generateDailyEnglish() {
  const themes = [
    "生活日常", "餐廳服務", "點餐與用餐", "朋友對話", "工作場合",
    "臨時狀況", "情緒與反應", "抱怨與處理問題", "禮貌與應對", "外出與交通"
  ];
  const pickedTheme = themes[Math.floor(Math.random() * themes.length)];
  const bannedWords = recentEnglishPool.size ? Array.from(recentEnglishPool).join(", ") : "（目前沒有）";

  const prompt = `
這次的英文主題是：「${pickedTheme}」。
請產生 10 個英文單字或片語。
【防重複規則】
- 請避免使用下列近期已出現過的單字或片語：
${bannedWords}
【每一筆請提供以下欄位】
- word
- meaning（自然中文）
- pronounce_phonetic（英文拼音式，例如 GAR-nish）
- pronounce_zh（台式中文唸法，例如 嘎・你許）
- kk（KK 音標）
- example（生活或服務情境例句）
【只允許回傳 JSON array，不要任何說明】
`;
  try {
    const raw = await callOpenAIChat({ userPrompt: prompt, temperature: 0.7 });
    const items = safeParseJSON(raw);
    
    if (!items || !Array.isArray(items)) throw new Error("JSON format invalid");

    items.forEach(item => {
      if (item.word) recentEnglishPool.add(item.word.toLowerCase());
    });

    if (recentEnglishPool.size > MAX_RECENT) {
      const overflow = recentEnglishPool.size - MAX_RECENT;
      Array.from(recentEnglishPool).slice(0, overflow).forEach(w => recentEnglishPool.delete(w));
    }
    return items;
  } catch (err) {
    console.error("❌ generateDailyEnglish error:", err);
    return null;
  }
}

// ================================
// 📘 今日英文 Flex
// ================================
function buildDailyEnglishFlex(items) {
  return {
    type: "flex",
    altText: "📘 今日英文",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "📘 今日英文", weight: "bold", size: "xl" },
          ...items.flatMap(item => ([
            { type: "text", text: item.word, weight: "bold", size: "xl", margin: "md" },
            { type: "text", text: `🇹🇼 ${item.meaning}`, size: "md", color: "#555555" },
            { type: "text", text: `🔤 ${item.pronounce_phonetic}`, size: "md", color: "#333333" },
            { type: "text", text: `🗣 ${item.pronounce_zh}`, size: "md", color: "#333333" },
            { type: "text", text: `📖 KK：${item.kk}`, size: "sm", color: "#777777" },
            { type: "text", text: `💬 ${item.example}`, size: "sm", wrap: true }
          ]))
        ]
      }
    }
  };
}

// ======================================================
// 🖼 圖片翻譯（台灣代筆統一版｜v1.6.8 FINAL｜STEP2 FIXED）
// ======================================================
async function translateImage(messageId) {
  try {
    // ======================================================
    // ① 讀取 LINE 圖片
    // ======================================================
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const base64Image = Buffer.concat(chunks).toString("base64");

    // ======================================================
    // ② 呼叫 OpenAI Vision
    // ======================================================
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: MENU_VISION_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
請判斷這張圖片是否為菜單：

- 若是菜單，請依照 system 指示，完整翻譯每一道品項
  ・可以補充內容（例如套餐包含項目）
  ・翻成台灣餐廳實際會用的說法
  ・價格照原圖保留

若不是菜單（例如信件、公告、截圖），
請依照 system 指示處理文字內容。

請務必回傳 system 指定的 JSON 格式。
`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("❌ OpenAI Vision API error:", response.status);
      return null;
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;

    console.log("🧠 OpenAI Image Translation Raw:", raw);

    // ======================================================
    // ③ 安全解析 JSON（A / B / C）
    // ======================================================
    let parsed = safeParseJSON(raw);

    // 情況 A：{ mode: "text", content: "..." }
    if (
      parsed &&
      parsed.mode === "text" &&
      !parsed.items &&
      typeof parsed.content === "string"
    ) {
      parsed = {
        mode: "text",
        items: [{ translation: parsed.content.trim() }]
      };
    }

    // 情況 B：文字在 JSON 前面
    if (
      parsed &&
      parsed.mode === "text" &&
      !parsed.items
    ) {
      const textOnly = raw
        .replace(/```json[\s\S]*$/i, "")
        .replace(/```/g, "")
        .trim();

      if (textOnly) {
        parsed = {
          mode: "text",
          items: [{ translation: textOnly }]
        };
      }
    }

    // 情況 C：完全沒 JSON（fallback）
    if (!parsed) {
      const cleaned = raw
        ?.replace(/```[\s\S]*?```/g, "")
        ?.trim();

      if (cleaned) {
        parsed = {
          mode: "text",
          _from: "fallback",
          items: [{ translation: cleaned }]
        };
      }
    }

    // ======================================================
    // ④ 最終防線
    // ======================================================
    if (
      !parsed ||
      !parsed.mode ||
      !Array.isArray(parsed.items) ||
      parsed.items.length === 0 ||
      typeof parsed.items[0].translation !== "string"
    ) {
      return null;
    }

// ✨ 非菜單 → 才走台灣代筆
if (parsed.mode === "text") {
  const rewritten = await rewriteToTaiwanese({
    content: parsed.items[0].translation,
    temperature: 0.2
  });

  if (rewritten && rewritten.trim()) {
    parsed.items[0].translation = rewritten.trim();
  }
}

// 🍽 菜單 → 只做輕量潤飾（不重翻）
if (parsed.mode === "menu_high" || parsed.mode === "menu_low") {
  parsed.items = parsed.items.map(item => {
    if (!item.translation) return item;

    return {
      ...item,
      translation: polishMenuTranslation(item.translation)
    };
  });
}


    // ======================================================
    // 🧹 最終清潔
    // ======================================================
    parsed.items = parsed.items.map(item => {
  if (!item.translation) return item;

  return {
    ...item,
    translation: item.translation
      .replace(/\{\s*"mode"\s*:\s*"text"\s*\}/gi, "")
      .replace(/整理後的內容如下[:：]?/gi, "")
      .replace(/^-{3,}$/gm, "")
      .trim()
  };
});

    if (!parsed.items[0].translation) {
      return null;
    }

    return parsed;

  } catch (err) {
    console.error("❌ translateImage exception:", err);
    return null;
  }
}
// ======================================================
// LINE Webhook（Router 主流程｜v1.7.2 抗噪防火牆架構）
// ======================================================
app.post("/webhook", line.middleware(config), (req, res) => {
  // ⭐ ① 立刻回 OK 給 LINE，不超時
  res.status(200).send("OK");

  // ⭐ ② 背景處理，完全不阻塞
  setImmediate(async () => {
    try {
      for (const e of req.body.events || []) {
        const userId = e.source.userId;

// ================================
// 🖼 圖片處理（唯一入口｜結構鎖死版）
// ================================
if (e.message?.type === "image") {
  if (!imageTranslateSessions.has(userId)) continue;

  try {
    const result = await translateImage(e.message.id);
    let replyText = "";

    if (!result || !Array.isArray(result.items) || result.items.length === 0) {
      replyText = "⚠️ 圖片中未偵測到可翻譯文字";
    } else {
      if (result.mode === "menu_high") {
        replyText += "📋 菜單翻譯（完整）\n━━━━━━━━━━━\n";
        result.items.forEach(item => {
          if (!item.translation) return;
          if (item.name) replyText += `\n🍽 ${item.name}`;
          if (item.price) replyText += `　💰 ${item.price}`;
          replyText += `\n👉 ${item.translation}\n`;
        });

      } else if (result.mode === "menu_low") {
        replyText += "📋 菜單翻譯\n━━━━━━━━━━━\n";
        result.items.forEach(item => {
          if (item.translation) {
            replyText += `\n• ${item.translation}\n`;
          }
        });

      } else {
        // 一般文字
        replyText = result.items
          .map(i => String(i.translation || "").trim())
          .filter(t => t.length > 0)
          .join("\n");
      }
    }

    replyText = sanitizeTranslationOutput(replyText);

    await client.replyMessage(e.replyToken, {
      type: "text",
      text: replyText || "⚠️ 翻譯結果為空"
    });

  } catch (err) {
    console.error("❌ image translate error:", err);
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "⚠️ 圖片翻譯失敗"
    });
  }

  continue;
}
      // ================================
      // 🚫 非文字事件一律跳過
      // ================================
      if (e.message?.type !== "text") continue;
      const text = e.message.text.trim();

      // ================================
      // 🛡️ 快速防火牆（抗噪過濾）
      // ================================
    const commandKeywords = [
  "股 ", "查股票", "查業績",
  "查資金", "查銀行資金", "查銀行資金水位",
  "大哥您好", 
  "今日英文", 
  "天氣", "查天氣", 
  "待辦", 
  "翻譯圖片", "結束翻譯",
  "查購物車", "查清單"
];
      const fixedCommands = ["台指期","台指","櫃買","OTC","大盤"];

      // ⭐ 狀態保命判斷（如果處於對話中流程，不予過濾）
      const isStateful = 
        imageTranslateSessions.has(userId) || 
        (handleHSR.isInSession && handleHSR.isInSession(userId));

      // ✨ v1.7.2 優化：將「翻譯內容」指令獨立抓取
      const isTranslateCmd = text === "翻譯" || text.startsWith("翻譯 ") || text.startsWith("翻譯\n");

      const isCommand = 
        isStateful || 
        isTranslateCmd || 
        commandKeywords.some(k => text.startsWith(k)) || 
        fixedCommands.includes(text);

      // ❌ 閒聊訊息在此秒殺
      if (!isCommand) continue;

      console.log(`🎯 [CMD] ${nowTW()} 收到指令：`, text.slice(0, 20));

      // ================================
      // 🖼 啟動圖片翻譯
      // ================================
      if (text === "翻譯圖片") {
  imageTranslateSessions.add(userId);
  // ❌ 不回任何訊息
  continue;
}
      
// ================================
// 🛑 結束圖片翻譯（安靜模式）
// ================================
if (text === "結束翻譯") {
  // 不管有沒有在翻譯狀態，一律清掉
  imageTranslateSessions.delete(userId);

  // ❌ 不回任何訊息
  continue;
}

      
// ================================
// 📘 文字翻譯（智慧分流｜定版）
// ================================
if (isTranslateCmd) {
  const content = text
    .replace(/^翻譯[\s\n]*/g, "")
    .trim();

  if (!content) {
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "請在「翻譯」後面貼上要翻的內容 🙂"
    });
    continue;
  }

  let result = "";

  // 🇹🇼 中文 → 英文（忠實翻譯）
  if (isMostlyChinese(content)) {
    result = await translateChineseToEnglish(content);
  }
  // 🌍 外文 → 台灣中文代筆
  else {
    result = await translateText(content);
  }

  await client.replyMessage(e.replyToken, {
    type: "text",
    text: result || "⚠️ 翻譯失敗，請稍後再試"
  });

  continue;
}
      


      // ================================
      // 📘 今日英文
      // ================================
      if (text === "今日英文") {
        const items = await generateDailyEnglish();
        if (!items || !Array.isArray(items)) {
          await client.replyMessage(e.replyToken, { type: "text", text: "⚠️ 今日英文暫時無法產生" });
        } else {
          await client.replyMessage(e.replyToken, buildDailyEnglishFlex(items));
        }
        continue;
      }

      // ===== Tier 1：即時指令 =====
      
      // 📊 股票查詢
      if (text.startsWith("股 ") || text.startsWith("查股票 ") || ["台指期","台指","櫃買","OTC","大盤"].includes(text)) {
        const id = ["台指期","台指","櫃買","OTC","大盤"].includes(text) 
          ? text 
          : text.replace("查股票", "").replace("股", "").trim();
        const data = await getStockQuote(id);
        const flex = buildStockSingleFlex(data);
        await client.replyMessage(e.replyToken, flex);
        continue;
      }
      
      // 🛒 購物車
      if (["查購物車", "查清單", "查股票 購物車"].includes(text)) {
        try {
          const c = await auth.getClient();
          const sheets = google.sheets({ version: "v4", auth: c });
          const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "購物車!A:A" });
          const symbols = (r.data.values || []).map(v => v[0]).filter(Boolean);

          if (!symbols.length) {
            await client.replyMessage(e.replyToken, { type: "text", text: "📋 我的購物車\n━━━━━━━━━━━\n\n（清單是空的）" });
          } else {
            const results = [];
            for (const s of symbols) {
              const data = await getStockQuote(s);
              if (data) results.push(data);
            }
            await client.replyMessage(e.replyToken, buildStockListFlex(results));
          }
        } catch (err) {
          console.error("❌ 查購物車失敗:", err);
          await client.replyMessage(e.replyToken, { type: "text", text: "⚠️ 查購物車失敗" });
        }
        continue;
      }
        
        // 💰 銀行資金水位（GAS Flex｜明確查詢指令）
if (
  text === "查資金" ||
  text === "查銀行資金" ||
  text === "查銀行資金水位"
) {
  try {
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbytQhYSRazKhZemk1jsKKEsNT1v3i_55kN5MdlzyUxL3zJq0v3uCaYna-IxNBS_nYEKQA/exec?action=fund"
    );

    if (!res.ok) throw new Error("GAS response not OK");

    const flex = await res.json();

    await client.replyMessage(e.replyToken, flex);

  } catch (err) {
    console.error("❌ 資金水位查詢失敗:", err);
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "⚠️ 目前無法取得資金水位"
    });
  }

  continue;
}

      // 🌤 天氣
      const city = parseWeather(text);
      if (city !== null) {
        const r = await get36hrWeather(CITY_MAP[city] || "高雄市");
        await client.replyMessage(e.replyToken, { type: "text", text: buildWeatherFriendText(r) });
        continue;
      }

      // 📋 待辦
      if (todoCmd.keywords?.some(k => text.startsWith(k))) {
        await todoCmd.handler(client, e);
        continue;
      }

      // ======================================================
      // 📈 業績查詢
      // ======================================================
      if (text.startsWith("查業績")) {
        const shopName = text.replace("查業績", "").trim();
        
        // 若有指定店名，檢查是否存在
        if (shopName && !SHOP_LIST.includes(shopName)) {
          await client.replyMessage(e.replyToken, { type: "text", text: `❌ 找不到店名「${shopName}」` });
          continue;
        }

        const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
        const targetShops = shopName ? [shopName] : SHOP_LIST;
        const shops = [];

        for (const s of targetShops) {
          const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${s}!A:Q` });
          const rows = r.data.values || [];
          if (rows.length < 2) continue;
          const last = rows.at(-1);
          shops.push({
            name: s,
            date: last[5]?.slice(5),
            revenue: Number(last[6] || 0),
            qty: Number(last[8] || 0),
            unit: last[9],
            fp: Number(last[10] || 0),
            fpRate: Number(last[11] || 0),
            bp: Number(last[12] || 0),
            bpRate: Number(last[13] || 0),
            hrTotal: Number(last[14] || 0),
            hrTotalRate: Number(last[15] || 0)
          });
        }

        if (!shops.length) {
          await client.replyMessage(e.replyToken, { type: "text", text: "目前沒有資料" });
          continue;
        }

        if (shopName) {
          // 單店模式 Bubble
          const shop = shops[0];
          const c1Flex = buildDailySummaryFlex({ date: shop.date, shops: [shop] });
          const c1Contents = c1Flex.contents.body.contents;
          const singleShopHeader = { type: "text", text: `${shop.name}｜${shop.date}`, weight: "bold", size: "xl", margin: "md" };
          const c1BodyItems = c1Contents[1].contents[0].contents.slice(1).map(item => ({ ...item, margin: "md" }));
          
          const ratioBubble = await readShopRatioBubble({ shop: shopName, date: shop.date });
          const c2Contents = ratioBubble ? ratioBubble.body.contents.slice(2) : [];
          
          const mergedContents = [singleShopHeader, { type: "separator", margin: "xl" }, ...c1BodyItems];
          if (c2Contents.length) mergedContents.push({ type: "separator", margin: "xl" }, ...c2Contents);

          await client.replyMessage(e.replyToken, {
            type: "flex", altText: `📊 ${shopName} 營運報表`,
            contents: { type: "bubble", size: "mega", body: { type: "box", layout: "vertical", contents: mergedContents } }
          });
        } else {
          // 全店模式 Carousel
          const flex = await buildDailyReportCarousel({ date: shops[0].date, shops });
          await client.replyMessage(e.replyToken, flex);
        }
        continue;
      }

      
      // 🧾 業績回報（定版｜三店＋三表）
if (text.startsWith("大哥您好")) {
  const p = parseSales(text);            // ⭐ 日期只在這裡解析
  const shop = detectShop(text);         // ⭐ 唯一店名來源

  // 🚫 沒有明確店名，直接跳過
  if (!shop) {
    console.log("⚠️ 無法判斷店名，略過三表與業績寫入");
    continue;
  }

  try {
    await ensureSheet(shop);

    // ① 寫入業績主表
    const row = await writeShop(shop, text, userId);

    // ② 寫入三表（水電瓦斯）
    await writeUtilities({
      shop,
      date: p.date,   // ⭐ 跟業績完全同一天
      text,
      userId
    });
    await writeTimeSales({
  shop,
  date: p.date,
  text,
  userId
});

    // ③ 寫入銷售佔比
    if (SHOP_RATIO_FIELDS[shop]) {
      let comboMap = {};

      if (shop === "茶六博愛") {
        comboMap = parseTea6Combos(text);
      } else if (shop === "三山博愛") {
        comboMap = parseSanshanCombos(text);
      } else if (shop === "湯棧中山") {
        comboMap = parseTangzhanCombos(text);
      }

      await writeShopRatios({ shop, row, comboMap });
      console.log("🍱 銷售佔比已寫入", shop, row);
    }

  } catch (err) {
    console.error("❌ 業績回報失敗:", err);
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "⚠️ 業績回報失敗"
    });
  }

  continue;
}

      // 🚄 高鐵
const hsrResult = await handleHSR(e);
if (typeof hsrResult === "string") {
  await client.replyMessage(e.replyToken, {
    type: "text",
    text: hsrResult
  });
  continue;
}

      } // ← for (const e ...) 結束
    } catch (err) {
      console.error("❌ LINE Webhook Error:", err);
    }
  }); // ← setImmediate 結束
});   // ← app.post 結束



// ======================================================
// ✅ 定版修正：讀取各店銷售佔比
// ======================================================
async function readShopRatioBubble({ shop, date }) {
  if (!auth) return null;
  const fields = SHOP_RATIO_FIELDS[shop];
  if (!fields) return null;
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${shop}!R:AZ` });
  const last = r.data.values?.at(-1);
  if (!last) return null;

  const items = [];
  for (let i = 0; i < fields.length; i++) {
    const col = i * 2;
    const qty = Number(last[col] || 0);
    const ratio = Number(last[col + 1] || 0);
    if (qty > 0 || fields[i] === "麻油、燒酒鍋" || fields[i] === "冷藏肉比例") {
      items.push({ name: fields[i], qty, ratio });
    }
  }

  if (shop === "湯棧中山") {
    const oilMixTotal = items.find(i => i.name === "麻油、燒酒鍋");
    const coldTotal = items.find(i => i.name === "冷藏肉比例");
    const hotpot = items.filter(i => !i.name.includes("冷藏") && i.name !== "麻油、燒酒鍋").sort((a, b) => b.qty - a.qty);
    const cold = items.filter(i => i.name.includes("冷藏") && i.name !== "冷藏肉比例").sort((a, b) => b.qty - a.qty);
    const finalItems = [...hotpot, ...(oilMixTotal ? [oilMixTotal] : []), ...cold, ...(coldTotal ? [coldTotal] : [])];
    return buildShopRatioBubble({ shop, date, items: finalItems });
  }

  return buildShopRatioBubble({ shop, date, items: items.sort((a, b) => b.qty - a.qty) });
}

// ======================================================
// 每日摘要 API（08:00 推播用）
// ======================================================
app.post("/api/daily-summary", async (req, res) => {
  try {
    if (!auth) return res.status(500).send("No Auth");
    const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });
    const shops = [];
    for (const s of SHOP_LIST) {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${s}!A:Q` });
      const rows = r.data.values || [];
      if (rows.length < 2) continue;
      const last = rows.at(-1);
      shops.push({
        name: s, date: last[5]?.slice(5), revenue: Number(last[6]||0), qty: Number(last[8]||0), qtyLabel: s==="湯棧中山"?"總鍋數":"套餐數", unit: last[9],
        fp: Number(last[10]||0), fpRate: Number(last[11]||0), bp: Number(last[12]||0), bpRate: Number(last[13]||0), hrTotal: Number(last[14]||0), hrTotalRate: Number(last[15]||0)
      });
    }
    if (!shops.length) return res.send("no data");
    const flex = await buildDailyReportCarousel({ date: shops[0].date, shops });
    await client.pushMessage(process.env.BOSS_USER_ID, flex);
    res.send("OK");
  } catch (err) {
    console.error("❌ daily-summary failed:", err);
    res.status(500).send("fail");
  }
});

// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
