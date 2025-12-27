// ======================================================
// 毛怪秘書 LINE Bot — index.js
// Router 穩定定版 v1.5.0（功能鎖死版）
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
// 【重要規範（不可違反）】
// ------------------------------------------------------
// ⚠️ 新增功能一律只動 index.js + 新模組
// ⚠️ 不得在狀態機模組內判斷其他指令
// ⚠️ 不得修改既有指令語意
// ⚠️ 高鐵模組已完全解耦，不可加 escape / fallback
//
// 【版本備註】
// ------------------------------------------------------
// v1.5.0
// - 股票 / 指數 / 台指期：
//   ・盤中即時價格修正（成交價 / 買一 / 賣一 / 快取）
//   ・指數與期貨價格顯示改為整數（不顯示小數）
// - 股票 Flex / 清單 Flex 顯示行為定版
// - TradingView 訊號 Flex 化完成（文字為備援）
// - 本版本起視為「行為鎖死基準版」
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

// ======================================================
// 茶六套餐佔比寫入（B2）
// ======================================================
async function writeTea6Combos(row, comboMap) {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  // 固定欄位順序（⚠️ 這是定錨，不要動）
  const FIELDS = [
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

  const values = [];

  for (const name of FIELDS) {
    const item = comboMap[name] || { qty: 0, ratio: 0 };
    values.push(item.qty);
    values.push(item.ratio);
  }

  // R 欄起（第 18 欄）
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `茶六博愛!R${row}`,
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
// 三店總覽 Flex（C1｜完整摘要｜字體放大｜業績粗體｜人事條件反紅）
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

            const block = [
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                  { type: "text", text: shop.name, weight: "bold", size: "lg" },
                  {
                    type: "text",
                    text: `💰 業績：${shop.revenue.toLocaleString()}`,
                    size: "md",
                    weight: "bold"
                  },
                  { type: "text", text: `📦 ${shop.qtyLabel}：${shop.qty}`, size: "md" },
                  { type: "text", text: `🧾 客單價：${shop.unit}`, size: "md" },

                  { type: "text", text: `👥 外場：${shop.fp.toLocaleString()}（${shop.fpRate}%）`, size: "md" },
                  { type: "text", text: `👥 內場：${shop.bp.toLocaleString()}（${shop.bpRate}%）`, size: "md" },
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
// ===== 業績回報（只寫不回｜定版）=====
if (text.startsWith("大哥您好")) {
  const shop =
    text.includes("湯棧") ? "湯棧中山"
    : text.includes("三山") ? "三山博愛"
    : "茶六博愛";

  try {
    // 1️⃣ 確保店別分頁存在（既有定版）
    await ensureSheet(shop);

    // 2️⃣ 寫入【定版】主業績資料，並「唯一可信」取得 row
    const row = await writeShop(shop, text, e.source.userId);

    // 3️⃣ 僅茶六博愛：寫入套餐佔比（B2 正式接線）
    if (shop === "茶六博愛") {
      const combo = parseTea6Combos(text);

      // 🔥 關鍵：用「同一個 row」寫入 R 欄後套餐佔比
      await writeTea6Combos(row, combo);

      console.log("🍱 茶六套餐佔比已寫入", {
        shop,
        row,
        combo
      });
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
// 每日摘要 API（08:00 推播用）
// ======================================================
app.post("/api/daily-summary", async (req, res) => {
  try {
    const sheets = google.sheets({ version: "v4", auth: await auth.getClient() });

    // ---------- C1 ----------
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

    if (!shops.length) return res.send("no data");

    await client.pushMessage(
      process.env.BOSS_USER_ID,
      buildDailySummaryFlex({ date: shops[0].date, shops })
    );

    // ---------- C2 ----------
    const ratioBubbles = [];

    // 茶六（真實資料）
    const r2 = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "茶六博愛!R:AO"
    });
    const lastCombo = r2.data.values?.at(-1) || [];
    const FIELDS = [
      "極品豚肉套餐","豐禾豚肉套餐","特級牛肉套餐","上等牛肉套餐",
      "真饌和牛套餐","極炙牛肉套餐","日本和牛套餐","三人豚肉套餐",
      "三人極上套餐","御。和牛賞套餐","聖誕歡饗套餐"
    ];
    const items = [];
    for (let i = 0; i < FIELDS.length; i++) {
      const qty = Number(lastCombo[i * 2] || 0);
      const ratio = Number(lastCombo[i * 2 + 1] || 0);
      if (qty > 0) items.push({ name: FIELDS[i], qty, ratio });
    }
    if (items.length) {
      ratioBubbles.push(
        buildShopRatioBubble({
          shop: "茶六博愛",
          date: shops[0].date,
          items: items.sort((a,b)=>b.qty-a.qty).slice(0,8)
        })
      );
    }

    // 三山 / 湯棧（暫時假資料）
    ratioBubbles.push(buildShopRatioBubble({
      shop:"三山博愛",date:shops[0].date,
      items:[{name:"豬&豬套餐",qty:48,ratio:18.6}]
    }));
    ratioBubbles.push(buildShopRatioBubble({
      shop:"湯棧中山",date:shops[0].date,
      items:[{name:"麻油鍋",qty:112,ratio:22.8}]
    }));

    await client.pushMessage(process.env.BOSS_USER_ID, {
      type:"flex",
      altText:"🍱 三店銷售佔比",
      contents:{ type:"carousel", contents:ratioBubbles }
    });

    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("fail");
  }
});
    
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
