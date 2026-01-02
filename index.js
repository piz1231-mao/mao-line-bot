// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 穩定定版 v1.6.3（營運報表顯示定版｜行為鎖死）
//
// 【架構定位（已定版）】
// ------------------------------------------------------
// - index.js 為「唯一 Router / 裁判」
// - 所有指令一律先在此判斷
// - 不允許 service / handler / command 搶事件
// - 狀態型功能（如高鐵）僅在被明確指派時啟動
//
// 【功能總覽（全部已驗證可用）】
// ------------------------------------------------------
// 即時指令（無狀態，高優先）
// - 📊 股票查詢（單筆）
//   ・股 2330
//   ・查股票 3189
//   ・指數 / 期貨：台指期 / 台指 / 櫃買 / OTC / 大盤
//
// - 🛒 股票清單（購物車模式）
//   ・查購物車
//   ・查清單
//   ・查股票 購物車
//   （顯示：現價 / 漲跌 / 漲跌幅）
//
// - 🌤 天氣查詢
//   ・天氣 台中
//   ・查天氣 雲林
//
// - 📋 待辦事項
//   ・待辦：XXXX
//
// - 📈 業績查詢
//   ・查業績
//   ・查業績 茶六博愛
//
// - 🧾 業績回報（只寫不回）
//   ・大哥您好～
//
// 【狀態型流程（明確起手）】
// ------------------------------------------------------
// - 🚄 高鐵查詢
//   ・查高鐵 → 北上 / 南下 → 起訖站 → 時間
//
// 【系統功能（鎖死）】 
// ------------------------------------------------------
// - TradingView Webhook（Flex / 文字 fallback）
// - Google Sheet：
//   ・業績寫入
//   ・業績查詢
//   ・購物車清單
//
// - 📊 每日營運總覽（08:00 推播）
//   ・C1：三店營運摘要
//   ・C2：各店銷售佔比（全品項顯示）
//
// 【C1｜每日營運總覽 顯示規格（v1.6.3 定版）】
// ------------------------------------------------------
// - 💵 業績（現金流語意）
// - 🍱 套餐數（茶六 / 三山）
// - 🍲 總鍋數（湯棧中山）
// - 🧾 客單價
// - 👥 人事（外場 / 內場 / 總人事）
//   ⚠️ 人事顯示與判斷條件鎖死，不再調整
//
// 【C2｜各店銷售佔比 顯示規格（v1.6.3 定版）】
// ------------------------------------------------------
// - 🍱 茶六博愛 / 三山博愛｜銷售佔比
// - 🍲 湯棧中山｜銷售佔比
// - 全部品項顯示（不限制 Top N）
// - 排序依資料層結果，顯示層不重排
//
// - 湯棧中山採「上下雙區塊」：
//   ・上半段：鍋物（含聖誕）
//   ・下半段：冷藏肉
//
// - 「麻油、燒酒鍋」「冷藏肉比例」為彙總列：
//   ・不參與排名
//   ・僅作為視覺區隔（粗體顯示）
//
// - 🔢 區塊內獨立排名（僅視覺效果）：
//   ・鍋物區前三名：紅 / 橘 / 金
//   ・冷藏肉區前三名：紅 / 橘 / 金
//   ・兩區排名互不影響
//   ・不使用 emoji（避免 JSON 體積膨脹）
//
// 【重要規範（不可違反）】
// ------------------------------------------------------
// ⚠️ 新增功能一律只動 index.js + 新模組
// ⚠️ 不得在狀態機模組內判斷其他指令
// ⚠️ 不得修改既有指令語意
// ⚠️ 高鐵模組已完全解耦，不可加 escape / fallback
// ⚠️ C2 排名僅屬顯示層，不得影響資料寫入與排序邏輯
//
// 【版本備註】
// ------------------------------------------------------
// v1.6.3
// - C1 / C2 emoji 語意正式定版（💵 / 🍱 / 🍲 / 🧾）
// - C2 銷售佔比採雙區塊「獨立排名顏色」顯示
// - 全品項顯示結構穩定化（已驗證不噴 400）
// - C1 + C2 合併單一 Carousel 推播（流檢同款）
// - 本版本起視為「營運報表顯示最終定版」
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
// ======================================================
// 📘 今日英文｜防重複資料存取（本機 / Render 通用）
// ======================================================
const DAILY_ENGLISH_PATH = "./data/daily_english_used.json";

function loadUsedEnglish() {
  try {
    if (!fs.existsSync(DAILY_ENGLISH_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(DAILY_ENGLISH_PATH, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("❌ loadUsedEnglish error:", err);
    return [];
  }
}

function saveUsedEnglish(words) {
  try {
    // ✅ Render / 雲端需要確保資料夾存在
    const dir = "./data";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    fs.writeFileSync(
      DAILY_ENGLISH_PATH,
      JSON.stringify(words, null, 2),
      "utf8"
    );
  } catch (err) {
    console.error("❌ saveUsedEnglish error:", err);
  }
}

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
const TEMPLATE_SHEET = "茶六博愛";
const SHOP_LIST = ["茶六博愛", "三山博愛", "湯棧中山"];

// ======================================================
// Google Auth（Render / 本機通用｜定版）
// ======================================================
function getGoogleAuth() {
  // ✅ Render / 雲端（base64）
  if (process.env.GOOGLE_CREDENTIALS_B64) {
    const json = Buffer
      .from(process.env.GOOGLE_CREDENTIALS_B64, "base64")
      .toString("utf8");

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
async function readShopRatio({ shop, fields, date }) {
  const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!R:AZ`
  });

  const last = r.data.values?.at(-1) || [];
  const items = [];

  for (let i = 0; i < fields.length; i++) {
    const qty = Number(last[i * 2] || 0);
    const ratio = Number(last[i * 2 + 1] || 0);
    if (qty > 0) {
      items.push({ name: fields[i], qty, ratio });
    }
  }

  return buildShopRatioBubble({
    shop,
    date,
    items: items.sort((a, b) => b.qty - a.qty).slice(0, 8)
  });
}
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
// 茶六套餐解析器（v1.4 定版｜符號容錯）
// ======================================================
function parseTea6Combos(text) {
  // ⚠️ 前處理：只統一冒號與 %
  // 「。」不要在這裡動，交給 regex 處理
  const t = text
    .replace(/：/g, ":")
    .replace(/％/g, "%");

  const items = [
    "極品豚肉套餐",
    "豐禾豚肉套餐",
    "特級牛肉套餐",
    "上等牛肉套餐",
    "真饌和牛套餐",
    "極炙牛肉套餐",
    "日本和牛套餐",
    "三人豚肉套餐",
    "三人極上套餐",
    "御。和牛賞套餐",
    "聖誕歡饗套餐"
  ];

  // regex escape（必要）
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const result = {};

  for (const name of items) {
    /**
     * 🔥 關鍵修正：
     * - 先 escape
     * - 再把「。」轉成 .?（0 或 1 個任意字元）
     *   → 可吃：。 . 空白 · 甚至沒符號
     */
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
    /**
     * 支援三種格式：
     * 1️⃣ 名稱 qty ratio%
     * 2️⃣ 名稱 ratio%
     * 3️⃣ 名稱 qty
     */
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
// 通用：各店套餐 / 鍋型佔比寫入（R 欄）
// ======================================================
async function writeShopRatios({ shop, row, comboMap }) {
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
// Sheet 操作（定版）
// ======================================================
async function ensureSheet(shop) {
  if (shop === TEMPLATE_SHEET) return;

  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID
  });

  if (meta.data.sheets.some(s => s.properties.title === shop)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: shop } } }]
    }
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

  // ✅ 只信 append 回來的 row
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

  // ✅ 關鍵：把 row 回傳出去
  return row;
}

// ======================================================
// 各店銷售佔比欄位定版（⚠️ 不可亂動）
// ======================================================
const SHOP_RATIO_FIELDS = {
  "茶六博愛": [
    "極品豚肉套餐","豐禾豚肉套餐","特級牛肉套餐","上等牛肉套餐",
    "真饌和牛套餐","極炙牛肉套餐","日本和牛套餐",
    "三人豚肉套餐","三人極上套餐","御。和牛賞套餐","聖誕歡饗套餐"
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
// - 08:00 推播、查業績 都只呼叫這裡
// ======================================================
async function buildDailyReportCarousel({ date, shops }) {
  const bubbles = [];

  // 第一頁：C1 總覽
  bubbles.push(
    buildDailySummaryFlex({
      date,
      shops
    }).contents   // ⚠️ 只取 bubble
  );

  // 後面頁：C2 各店銷售佔比
  for (const s of SHOP_LIST) {
    const bubble = await readShopRatioBubble({
      shop: s,
      date
    });
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
// C1｜三店總覽 Flex（v1.6.3 定版）
// - 💵 業績（現金流語意）
// - 🍱 套餐數（茶六 / 三山）
// - 🍲 總鍋數（湯棧中山）
// - 🧾 客單價
// - 👥 人事（外 / 內 / 總）【⚠️ 鎖死不再調整】
// - 人事超標條件反紅（行為不變）
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

            // 🔧 數量欄位 emoji / label 依店別切換
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
              block.push({
                type: "separator",
                margin: "lg"
              });
            }

            return block;
          })
        ]
      }
    }
  };
}
// ======================================================
// C2-1 單店銷售佔比 Bubble（v1.6.3｜冷藏肉獨立排名＋emoji 規格修正）
// ======================================================
function buildShopRatioBubble({ shop, date, items }) {
  const contents = [];

  // 🔧 表頭 emoji 依店別修正
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

  // ================================
  // 🔢 建立「區塊內排名 index」
  // ================================
  let hotRank = 0;
  let coldRank = 0;
  let coldSectionStarted = false;

  items.forEach(item => {
    const isOilMix    = item.name === "麻油、燒酒鍋";
    const isColdRatio = item.name === "冷藏肉比例";
    const isColdItem  = item.name.includes("冷藏");

    // === 判斷這一列要不要算排名 ===
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
      isTop1 ? "#D32F2F" :   // 🥇
      isTop2 ? "#F57C00" :   // 🥈
      isTop3 ? "#FBC02D" :   // 🥉
      "#333333";

    const nameWeight =
      (isOilMix || isColdRatio || isTop1 || isTop2 || isTop3)
        ? "bold"
        : "regular";

    // 🔹 冷藏區分隔線（只出現一次）
    if (!coldSectionStarted && isColdItem) {
      contents.push({
        type: "separator",
        margin: "xl"
      });
      coldSectionStarted = true;
    }

    contents.push({
      type: "box",
      layout: "horizontal",
      margin: (isOilMix || isColdRatio) ? "xl" : "md",
      contents: [
        // 品項名稱
        {
          type: "text",
          text: item.name,
          flex: 5,
          size: "md",
          wrap: true,
          weight: nameWeight,
          color: rankColor
        },
        // 份數
        {
          type: "text",
          text: `${item.qty}`,
          flex: 2,
          size: "md",
          align: "end",
          weight: (isOilMix || isColdRatio) ? "bold" : "regular"
        },
        // 佔比 %
        {
          type: "text",
          text:
            item.ratio !== undefined && item.ratio !== ""
              ? `${item.ratio}%`
              : "",
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
// ======================================================
// C2-2 三店銷售佔比 Carousel（定版）
// ======================================================
function buildShopRatioCarousel(bubbles) {
  return {
    type: "flex",
    altText: "🍱 三店銷售佔比",
    contents: {
      type: "carousel",
      contents: bubbles   // ⚠️ 每一個都必須是 bubble
    }
  };
}

// ======================================================
// 單店｜查業績用「快速 Flex」（B 類）
// ======================================================
function buildShopQuickFlex(shop) {
  const qtyEmoji = shop.name === "湯棧中山" ? "🍲" : "🍱";
  const qtyLabel = shop.name === "湯棧中山" ? "總鍋數" : "套餐數";

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `【${shop.name}｜${shop.date}】`,
          weight: "bold",
          size: "lg"
        },
        {
          type: "text",
          text: `💵 業績：${shop.revenue.toLocaleString()}`,
          weight: "bold",
          size: "md"
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
          text: `👥 總計：${shop.hrTotal.toLocaleString()}（${shop.hrTotalRate}%）`,
          size: "md",
          weight: "bold"
        }
      ]
    }
  };
}

// ======================================================
// LINE Webhook（Router 主流程）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {
      if (e.message?.type !== "text") continue;
      const text = e.message.text.trim();

/// ================================
// 📘 翻譯功能（需明確指令）
// ================================
if (text.startsWith("翻譯 ")) {
  const content = text.slice(3).trim(); // 拿掉「翻譯」

  if (!content) {
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "請在「翻譯」後面輸入內容 🙂"
    });
    continue;
  }

  const result = await translateText(content);

  await client.replyMessage(e.replyToken, {
    type: "text",
    text: result
  });
  continue;
}

      // ===== Tier 1：即時指令 =====


// ================================
// 📘 今日英文（手動）
// ================================
if (text === "今日英文") {
  const items = await generateDailyEnglish();

  if (!items || !Array.isArray(items)) {
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "⚠️ 今日英文暫時無法產生"
    });
    continue;
  }

  const flex = buildDailyEnglishFlex(items);

  await client.replyMessage(e.replyToken, flex);
  continue;
}

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
const flex = buildStockSingleFlex(data);
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

// ======================================================
// 📈 業績查詢（Router 定版）
// ======================================================

// ===== 模式 B：指定單店（一定要放前面）=====
if (text.startsWith("查業績 ")) {
  const shopName = text.replace("查業績", "").trim();

  if (!SHOP_LIST.includes(shopName)) {
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: `❌ 找不到店名「${shopName}」`
    });
    continue;
  }

  const sheets = google.sheets({
    version: "v4",
    auth: await auth.getClient()
  });

  // === 讀單店最新一筆 ===
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shopName}!A:Q`
  });

  const rows = r.data.values || [];
  if (rows.length < 2) {
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "目前沒有資料"
    });
    continue;
  }

  const last = rows.at(-1);
  const shop = {
    name: shopName,
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
  };

  // === 產生 C1（只拿內容，不用標題）===
  const c1Flex = buildDailySummaryFlex({
    date: shop.date,
    shops: [shop]
  });
  const c1Contents = c1Flex.contents.body.contents;

  // === 單店標題（最上面）===
  const singleShopHeader = {
    type: "text",
    text: `${shop.name}｜${shop.date}`,
    weight: "bold",
    size: "xl",
    margin: "md"
  };

  // === C1 主體（行距調成跟 C2 一樣）===
  const c1BodyItems = c1Contents[1].contents
    .slice(1) // 拿掉 C1 內部的店名
    .map(item => ({
      ...item,
      margin: "md"
    }));

  // === C2（單店銷售佔比）===
  const ratioBubble = await readShopRatioBubble({
    shop: shopName,
    date: shop.date
  });

  // 只拿品項（砍掉「銷售佔比標題＋日期」）
  const c2Contents = ratioBubble
    ? ratioBubble.body.contents.slice(2)
    : [];

  // === 合併成單一 Bubble ===
  const mergedContents = [
    singleShopHeader,
    { type: "separator", margin: "xl" },
    ...c1BodyItems
  ];

  if (c2Contents.length) {
    mergedContents.push(
      { type: "separator", margin: "xl" },
      ...c2Contents
    );
  }

  await client.replyMessage(e.replyToken, {
    type: "flex",
    altText: `📊 ${shopName} 營運報表`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        contents: mergedContents
      }
    }
  });

  continue;
}
      
// ===== 模式 A：不指定店名（共用引擎）=====
if (text === "查業績") {
  const sheets = google.sheets({
    version: "v4",
    auth: await auth.getClient()
  });

  const shops = [];

  for (const s of SHOP_LIST) {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${s}!A:Q`
    });

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
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "目前沒有資料"
    });
    continue;
  }

  const flex = await buildDailyReportCarousel({
    date: shops[0].date,
    shops
  });

  await client.replyMessage(e.replyToken, flex);
  continue;
}
  
      
// ===== 業績回報（只寫不回｜定版）=====
if (text.startsWith("大哥您好")) {
  const shop =
    text.includes("湯棧") ? "湯棧中山"
    : text.includes("三山") ? "三山博愛"
    : "茶六博愛";

  try {
    // 1️⃣ 確保店別分頁存在
    await ensureSheet(shop);

    // 2️⃣ 寫入主業績資料（唯一可信 row）
    const row = await writeShop(shop, text, e.source.userId);

    // 3️⃣ 寫入銷售佔比（如果該店有定義）
    if (SHOP_RATIO_FIELDS[shop]) {
      let comboMap = {};

      if (shop === "茶六博愛") {
        comboMap = parseTea6Combos(text);
      } else if (shop === "三山博愛") {
        comboMap = parseSanshanCombos(text);
      } else if (shop === "湯棧中山") {
        comboMap = parseTangzhanCombos(text);
      }

      await writeShopRatios({
        shop,
        row,
        comboMap
      });

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
// ✅ 定版修正：讀取各店銷售佔比（排序正確＋彙總列不參與）
// ======================================================
async function readShopRatioBubble({ shop, date }) {
  const fields = SHOP_RATIO_FIELDS[shop];
  if (!fields) return null;

  const sheets = google.sheets({
    version: "v4",
    auth: await auth.getClient()
  });

  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${shop}!R:AZ`
  });

  const last = r.data.values?.at(-1);
  if (!last) return null;

  const items = [];

  // 依欄位定錨讀資料
  for (let i = 0; i < fields.length; i++) {
    const col = i * 2;
    const name = fields[i];
    const qty = Number(last[col] || 0);
    const ratio = Number(last[col + 1] || 0);

    // qty > 0 才顯示，但「彙總列」例外一定要留
    if (qty > 0 || name === "麻油、燒酒鍋" || name === "冷藏肉比例") {
      items.push({ name, qty, ratio });
    }
  }

  // ==================================================
  // 🫕 湯棧中山：上下段排序＋彙總列獨立
  // ==================================================
  if (shop === "湯棧中山") {
    // 👉 抓彙總列（不參與排序）
    const oilMixTotal = items.find(i => i.name === "麻油、燒酒鍋");
    const coldTotal   = items.find(i => i.name === "冷藏肉比例");

    // ---- 上半段：鍋物＋聖誕（❌ 不含麻油、燒酒鍋）----
    const hotpot = items
      .filter(i =>
        !i.name.includes("冷藏") &&
        i.name !== "麻油、燒酒鍋"
      )
      .sort((a, b) => b.qty - a.qty);

    // ---- 下半段：冷藏肉（❌ 不含冷藏肉比例）----
    const cold = items
      .filter(i =>
        i.name.includes("冷藏") &&
        i.name !== "冷藏肉比例"
      )
      .sort((a, b) => b.qty - a.qty);

    // 👉 最終顯示順序（這裡就是 UI 規格）
    const finalItems = [
      ...hotpot,
      ...(oilMixTotal ? [oilMixTotal] : []),
      ...cold,
      ...(coldTotal ? [coldTotal] : [])
    ];

    return buildShopRatioBubble({
      shop,
      date,
      items: finalItems
    });
  }

  // ==================================================
  // 🍱 茶六 / 三山：全部商品一起依銷量排序
  // ==================================================
  return buildShopRatioBubble({
    shop,
    date,
    items: items.sort((a, b) => b.qty - a.qty)
  });
}

// ======================================================
// 每日摘要 API（08:00 推播用｜流檢同款｜只推一則）
// ======================================================
app.post("/api/daily-summary", async (req, res) => {
  try {
    const sheets = google.sheets({
      version: "v4",
      auth: await auth.getClient()
    });

    // ==================================================
    // C1｜讀取三店最新業績
    // ==================================================
    const shops = [];

    for (const s of SHOP_LIST) {
      const r = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${s}!A:Q`
      });

      const rows = r.data.values || [];
      if (rows.length < 2) continue;

      const last = rows.at(-1);

      shops.push({
        name: s,
        date: last[5]?.slice(5),
        revenue: Number(last[6] || 0),
        qty: Number(last[8] || 0),
        qtyLabel: s === "湯棧中山" ? "總鍋數" : "套餐數",
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
      return res.send("no data");
    }

// ==================================================
// ✅ 改用共用營運報表引擎（畫面不變）
// ==================================================
const flex = await buildDailyReportCarousel({
  date: shops[0].date,
  shops
});

await client.pushMessage(process.env.BOSS_USER_ID, flex);

    res.send("OK");
  } catch (err) {
    console.error("❌ daily-summary failed:", err);
    res.status(500).send("fail");
  }
});

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
      body: JSON.stringify({
        model,
        messages,
        temperature
      })
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
// 🤖 AI 翻譯（精簡回覆版｜餐飲 / 日常）
// ======================================================
async function generateDailyEnglish() {
  const usedWords = loadUsedEnglish();

  const prompt = `
你是一個 API，只能回傳 JSON，不要加任何說明文字。

請產生 10 個「生活常用為主、服務與餐飲現場也常會用到」的英文單字或片語。

【內容原則】
- 生活英文為主
- 餐飲 / 服務現場常用
- 避免非常基礎與重複單字
- 不要產生以下已用過的單字：
${usedWords.join(", ")}

【每一筆資料請提供以下欄位（全部都要）】
- word
- meaning
- respelling
- chinese_pronounce
- kk
- example

【只允許回傳 JSON array】
`;

  try {
    const raw = await callOpenAIChat({
      userPrompt: prompt,
      temperature: 0.4
    });

    const items = JSON.parse(raw);

    // ✅ 更新防重複清單
    const newWords = items.map(i => i.word);
    saveUsedEnglish([...usedWords, ...newWords]);

    return items;
  } catch (err) {
    console.error("❌ generateDailyEnglish error:", err);
    return null;
  }
}
// ======================================================
// 🤖 每日英文產生器（防重複版｜生活 / 餐飲）
// ======================================================
async function generateDailyEnglish() {
  const used = loadUsedEnglish(); // 已用過的單字（英文）

  const prompt = `
你是一個 API，只能回傳 JSON，不要加任何說明文字。

請產生 20 個「生活常用為主、服務與餐飲現場也常會用到」的英文單字或片語，
並且【避免使用以下已出現過的單字】：

${used.join(", ") || "（目前沒有）"}

【內容原則】
- 生活英文為主（不是教科書）
- 餐飲 / 服務現場自然會用到
- 請避免非常基礎、每天容易重複的單字

【每一筆資料請提供以下欄位（全部都要）】
- word
- meaning
- pronounce_phonetic（英文拼音唸法，例如 GAR-nish）
- kk（KK 音標）
- example

【只允許回傳 JSON array】

格式範例：
[
  {
    "word": "garnish",
    "meaning": "裝飾",
    "pronounce_phonetic": "GAR-nish",
    "kk": "/ˈɡɑːrnɪʃ/",
    "example": "The dish is garnished with herbs."
  }
]
`;

  try {
    const raw = await callOpenAIChat({
      userPrompt: prompt,
      temperature: 0.4
    });

    const list = JSON.parse(raw);

    // 只取前 10 個
    const today = list.slice(0, 10);

    // 記錄今天用過的單字
    const newUsed = [
      ...used,
      ...today.map(i => i.word)
    ];

    saveUsedEnglish(newUsed);

    return today;
  } catch (err) {
    console.error("❌ generateDailyEnglish error:", err);
    return null;
  }
}

// ================================
// 📘 今日英文 Flex（定版｜字體放大＋台味唸法）
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
          {
            type: "text",
            text: "📘 今日英文",
            weight: "bold",
            size: "xl"
          },
          ...items.flatMap(item => ([
            {
              type: "text",
              text: item.word,
              weight: "bold",
              size: "xl",
              margin: "md"
            },
            {
              type: "text",
              text: `🇹🇼 ${item.meaning}`,
              size: "md",
              color: "#555555"
            },
            // 🔤 英文拆音（給會看英文的人）
            {
              type: "text",
              text: `🔤 ${item.pronounce_phonetic}`,
              size: "md",
              color: "#333333"
            },
            // 🗣 台式唸法（給不會 KK 的人）
            {
              type: "text",
              text: `🗣 台式唸法：${item.chinese_pronounce}`,
              size: "md",
              color: "#333333"
            },
            // 📖 KK 音標（給專業或老師）
            {
              type: "text",
              text: `📖 KK：${item.kk}`,
              size: "sm",
              color: "#777777"
            },
            {
              type: "text",
              text: `💬 ${item.example}`,
              size: "sm",
              wrap: true
            }
          ]))
        ]
      }
    }
  };
}
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
