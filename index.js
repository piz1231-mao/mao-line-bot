// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 穩定定版 v1.6.6（圖片翻譯修復｜營運顯示鎖死）
//
// 【架構定位（已定版，不再變動）】
// ------------------------------------------------------
// - index.js 為「唯一 Router / 裁判」
// - 所有指令一律先在此判斷
// - 不允許 service / handler / command 搶事件
// - 狀態型功能必須「明確啟動」，不可自動觸發
// - 圖文、翻譯、AI 功能皆遵守「不誤判、不打架」原則
//
// 【功能總覽（目前已啟用）】
// ------------------------------------------------------
//
// 【Tier 1｜即時指令（無狀態，高優先）】
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
// - 📘 翻譯文字（需明確指令）
//   ・翻譯 這句話要怎麼說
//   ・翻譯 Please wait a moment
//   ⚠️ 僅在輸入「翻譯 」時才會啟動
//
// - 📘 今日英文（AI 產生）
//   ・今日英文
//   ・每次隨機 10 個單字 / 片語
//   ・含：中文解釋、拼音唸法、台式唸法、KK、例句
//   ・具備「記憶體防重複機制」（instance 層）
//
// 【Tier 2｜狀態型流程（需明確起手）】
// ------------------------------------------------------
// - 🖼 圖片翻譯（一次性狀態）
//   ・翻譯圖片 → 傳送圖片
//   ・僅翻譯圖片中文字
//   ・不會自動翻譯所有圖片
//   ・翻譯完成後自動清除狀態
//   ⚠️ 不會與發票、拍照、截圖功能衝突
//
// - 🚄 高鐵查詢
//   ・查高鐵 → 北上 / 南下 → 起訖站 → 時間
//   ・狀態機已完全解耦，不接受插隊判斷
//
// 【Tier 3｜營運 / 系統層功能（鎖死）】
// ------------------------------------------------------
// - 🧾 業績回報（只寫不回）
//   ・大哥您好～
//
// - 📈 業績查詢
//   ・查業績
//   ・查業績 茶六博愛
//
// - 📊 每日營運總覽（08:00 推播）
//   ・C1：三店營運摘要
//   ・C2：各店銷售佔比（全品項顯示）
//
// - TradingView Webhook
//   ・訊號接收（Flex / 文字 fallback）
//
// - Google Sheet 整合
//   ・業績寫入
//   ・業績查詢
//   ・購物車清單
//
// 【C1｜每日營運總覽 顯示規格（定版）】
// ------------------------------------------------------
// - 💵 業績（現金流語意）
// - 🍱 套餐數（茶六 / 三山）
// - 🍲 總鍋數（湯棧中山）
// - 🧾 客單價
// - 👥 人事（外場 / 內場 / 總人事）
//   ⚠️ 人事顯示與判斷條件已鎖死，不再調整
//
// 【C2｜各店銷售佔比 顯示規格（定版）】
// ------------------------------------------------------
// - 全品項顯示（不限制 Top N）
// - 排序依資料層結果，顯示層僅做視覺排名
//
// - 湯棧中山採「上下雙區塊」：
//   ・上半段：鍋物（含聖誕）
//   ・下半段：冷藏肉
//
// - 「麻油、燒酒鍋」「冷藏肉比例」為彙總列：
//   ・不參與排名
//   ・僅作為視覺區隔（粗體顯示）
//
// 【重要規範（不可違反）】
// ------------------------------------------------------
// ⚠️ 新增功能一律只動 index.js + 新模組
// ⚠️ 不得在狀態機模組內判斷其他指令
// ⚠️ 不得修改既有指令語意
// ⚠️ 圖片翻譯不可自動觸發
// ⚠️ C2 排名僅屬顯示層，不得影響資料寫入
//
// 【版本備註】
// ------------------------------------------------------
// v1.6.6
// - 修正：圖片翻譯現在可以正確識別非菜單的一般文字 (Prompt 優化)
// - 修正：Google Auth 增加雙重編碼防呆機制
// - 優化：Webhook 結構重整，將圖片處理邏輯獨立，避免與文字指令衝突
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
// 茶六套餐解析器（v1.4 定版｜符號容錯）
// ======================================================
function parseTea6Combos(text) {
  const t = text.replace(/：/g, ":").replace(/％/g, "%");

  const items = [
    "極品豚肉套餐", "豐禾豚肉套餐", "特級牛肉套餐", "上等牛肉套餐",
    "真饌和牛套餐", "極炙牛肉套餐", "日本和牛套餐",
    "三人豚肉套餐", "三人極上套餐", "御。和牛賞套餐", "聖誕歡饗套餐"
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

// ✅ 增加安全解析 JSON 的工具（v1.6.6 新增）
function safeParseJSON(raw) {
  if (!raw) return null;

  // 1️⃣ 移除 markdown code block
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 2️⃣ 嘗試抓「最後一個 JSON 物件」
  const jsonMatch = cleaned.match(/\{[\s\S]*\}$/);

  if (!jsonMatch) {
    console.error("❌ JSON not found in response:", cleaned);
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("❌ JSON parse failed:", jsonMatch[0]);
    return null;
  }
}
const TAIWAN_REWRITE_SYSTEM_PROMPT = `
你不是翻譯工具。你不是在「整理內容」，也不是在「說明翻譯結果」。

你的任務只有一個：
把圖片中的文字，直接改寫成「可直接使用的繁體中文內容」。把圖片中的文字，一直接改寫成「可直接使用的繁體中文內容」。的代筆者」。

【「台灣人會直接使用、直接轉寄、直接貼出去的代筆者」，又或者是像朋友一樣的角色 。中文」
2. 絕對禁止簡體字、中國用語、翻譯腔
3. 不需要逐句翻譯，可自由重寫、拆句、合併
4. 只要照原文翻會怪，就直接改寫

【語氣規則】
- 書信／通知：台灣常見商務書信語氣（自
5. 輸出的文字，看起來必須像是「原本就用中文寫的」
6. 禁止出現任何說明性語句，例如：
   - 整理後的內容如下
   - 以下為翻譯結果
   - 本文說明
7. 禁止使用任何分隔符號：
   - ---、——、===
8. 不要加標題、不加前言、不加結語然、不官腔）
- 一般說明：白話、好讀
- 菜單：台灣餐廳實際會用的菜名，不照字翻

【專有名詞在地化】
- pre-settlement → 交屋前
- settlement / handover → 交屋
- rectification → 修繕 / 改善
- body corporate → 管委會

【輸出要求】
- 請直接輸出「整理後、可直接使用的完整中文內容」
- 不要解釋、不加註解、不說你怎麼翻
`;
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
      systemPrompt: TAIWAN_REWRITE_SYSTEM_PROMPT,
      userPrompt: content,
      temperature
    });
  } catch (err) {
    console.error("❌ rewriteToTaiwanese error:", err);
    return "";
  }
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
// 🖼 圖片翻譯（台灣代筆統一版｜v1.6.8 FINAL｜FIXED）
// ======================================================
async function translateImage(messageId) {
  try {
    // ① 讀取 LINE 圖片
    const stream = await client.getMessageContent(messageId);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const base64Image = Buffer.concat(chunks).toString("base64");

    // ② 呼叫 OpenAI Vision
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
            content: TAIWAN_REWRITE_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `
這是一張圖片，裡面的文字可能來自掃描、拍照或截圖，
內容可能順序混亂、殘缺、不完整。

請你務必遵守以下流程：
1️⃣ 先「理解整體意思」
2️⃣ 再用台灣人實際會使用的方式「重新整理後重寫」
3️⃣ 不要被原本文字順序或格式綁住
4️⃣ 不需要保留原句結構，只求好讀、自然

接著請判斷內容類型並輸出 JSON：

- 菜單且有價格 → mode="menu_high"
- 菜單但模糊或無價格 → mode="menu_low"
- 其他（信件、公告、對話、截圖） → mode="text"

⚠️ 若 mode="text"：
- 請把所有內容整理成「一段順順讀的台灣中文」
- 不要逐句翻、不留英文、不條列原文
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

    // 🔍 Debug（穩定後可關）
    console.log("🧠 OpenAI Image Translation Raw:", raw);

    // ======================================================
    // ③ 安全解析 JSON
    // ======================================================
    let parsed = safeParseJSON(raw);

    // 🧠【關鍵修正 #1】
    // AI 只回 { mode: "text" }，但文字在 JSON 前面
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
          items: [
            { translation: textOnly }
          ]
        };
      }
    }

    // 🛡️【關鍵修正 #2】
    // Vision 完全沒給 JSON，但有文字
    if (!parsed) {
      const cleaned = raw
        ?.replace(/```[\s\S]*?```/g, "")
        ?.trim();

      if (cleaned) {
        console.warn("⚠️ Vision 未回 JSON，啟用純文字代筆 fallback");

        const rewritten = await translateText(cleaned);

        if (rewritten && rewritten.trim()) {
          parsed = {
            mode: "text",
            items: [
              { translation: rewritten }
            ]
          };
        }
      }
    }

    // ======================================================
    // ④ 最終防線（避免 LINE 回傳空字串 400）
    // ======================================================
    if (
      !parsed ||
      !parsed.mode ||
      !Array.isArray(parsed.items) ||
      parsed.items.length === 0 ||
      !parsed.items[0].translation ||
      !parsed.items[0].translation.trim()
    ) {
      return null;
    }

    return parsed;

  } catch (err) {
    console.error("❌ translateImage exception:", err);
    return null;
  }
}
// ======================================================
// LINE Webhook（Router 主流程｜v1.6.6 結構清洗版）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events || []) {
      const userId = e.source.userId;

      // ================================
      // 🖼 圖片處理 (唯一入口)
      // ================================
      if (e.message?.type === "image") {
        if (!imageTranslateSessions.has(userId)) continue;

        try {
          const result = await translateImage(e.message.id);

          // ⚠️ 只要有結果就回傳，不論是不是菜單
          if (!result || !Array.isArray(result.items) || result.items.length === 0) {
            await client.replyMessage(e.replyToken, {
              type: "text",
              text: "⚠️ 圖片中未偵測到可翻譯文字"
            });
          } else {
            let replyText = "";

            if (result.mode === "menu_high") {
              replyText += "📋 菜單翻譯（對應版）\n━━━━━━━━━━━\n";
              result.items.forEach(i => {
                if (i.translation) replyText += `\n🍽 ${i.name||""}\n💰 ${i.price||""}\n👉 ${i.translation}\n`;
              });
            } else if (result.mode === "menu_low") {
              replyText += "📋 菜單翻譯（分段理解）\n━━━━━━━━━━━\n";
              result.items.forEach(i => {
                if (i.translation) replyText += `\n• ${i.translation}\n`;
              });
            } else {
              // mode = text (一般文字)
              replyText = result.items
                .map(i => i.translation)
                .filter(Boolean)
                .join("\n");
            }

            await client.replyMessage(e.replyToken, {
              type: "text",
              text: replyText.trim() || "⚠️ 翻譯結果為空"
            });
          }
        } catch (err) {
          console.error("❌ image translate error:", err);
          await client.replyMessage(e.replyToken, { type: "text", text: "⚠️ 圖片翻譯失敗" });
        } finally {
          imageTranslateSessions.delete(userId);
        }
        continue;
      }

      // ================================
      // 🚫 非文字事件一律跳過
      // ================================
      if (e.message?.type !== "text") continue;
      const text = e.message.text.trim();

      // ================================
      // 🖼 啟動圖片翻譯
      // ================================
      if (text === "翻譯圖片") {
        imageTranslateSessions.add(userId);
        await client.replyMessage(e.replyToken, { type: "text", text: "📸 好，請傳一張要翻譯的圖片" });
        continue;
      }

// ================================
// 📘 文字翻譯（支援換行）
// ================================
if (text === "翻譯" || text.startsWith("翻譯\n") || text.startsWith("翻譯 ")) {
  const content = text
    .replace(/^翻譯[\s\n]*/g, "")
    .trim();

  if (!content) {
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: "請在「翻譯」後面貼上要翻的內容 🙂"
    });
  } else {
    const result = await translateText(content);
    await client.replyMessage(e.replyToken, {
      type: "text",
      text: result
    });
  }
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

      // 🧾 業績回報
      if (text.startsWith("大哥您好")) {
        const shop = text.includes("湯棧") ? "湯棧中山" : text.includes("三山") ? "三山博愛" : "茶六博愛";
        try {
          await ensureSheet(shop);
          const row = await writeShop(shop, text, userId);
          if (SHOP_RATIO_FIELDS[shop]) {
            let comboMap = {};
            if (shop === "茶六博愛") comboMap = parseTea6Combos(text);
            else if (shop === "三山博愛") comboMap = parseSanshanCombos(text);
            else if (shop === "湯棧中山") comboMap = parseTangzhanCombos(text);
            await writeShopRatios({ shop, row, comboMap });
            console.log("🍱 銷售佔比已寫入", shop, row);
          }
        } catch (err) {
          console.error("❌ 業績回報失敗:", err);
          await client.replyMessage(e.replyToken, { type: "text", text: "⚠️ 業績回報失敗" });
        }
        continue;
      }

      // 🚄 高鐵
      const hsrResult = await handleHSR(e);
      if (typeof hsrResult === "string") {
        await client.replyMessage(e.replyToken, { type: "text", text: hsrResult });
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
