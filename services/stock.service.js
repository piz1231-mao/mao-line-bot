// ======================================================
// 📊 Stock Service（最終定版）
// ------------------------------------------------------
// 資料來源策略（⚠️ 已定錨，不可任意更動）
//
// 1️⃣ 個股（上市 / 上櫃）
//    → 證交所官方 API（mis.twse.com.tw）
//
// 2️⃣ 指數
//    - 加權指數 → 證交所官方 API
//    - 櫃買指數 → 證交所官方 API
//
// 3️⃣ 台指期（TXF，含夜盤）
//    → 鉅亨網（Anue）JSON API
//    ※ Yahoo 已封鎖雲端 IP，正式棄用
//
// index.js 僅呼叫 getStockQuote，不需修改
// ======================================================

const axios = require("axios");

// ------------------------------------------------------
// 工具
// ------------------------------------------------------
const isStockId = (v) => /^\d{4}$/.test(v);

const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ======================================================
// 1️⃣ 官方指數（加權 / 櫃買）
// ======================================================
async function getOfficialIndex(type) {
  try {
    const ts = Date.now();

    // tse_t00.tw = 加權指數
    // otc_o00.tw = 櫃買指數
    const code = type === "OTC" ? "otc_o00.tw" : "tse_t00.tw";
    const name = type === "OTC" ? "櫃買指數" : "加權指數";

    const url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp` +
      `?ex_ch=${code}&json=1&delay=0&_=${ts}`;

    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];
    if (!info) return null;

    return {
      type: "index",
      id: type,
      name,
      price: num(info.z),   // 現價
      yPrice: num(info.y),  // 昨收
      open: num(info.o),
      high: num(info.h),
      low: num(info.l),
      time: info.t,
      url: "https://mis.twse.com.tw/"
    };
  } catch (err) {
    console.error(`❌ Official Index Error (${type})`, err.message);
    return null;
  }
}

// ======================================================
// 2️⃣ 官方個股（上市 / 上櫃）
// ======================================================
async function getTWSELikeQuote(stockId, market) {
  try {
    const ts = Date.now();
    const url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp` +
      `?ex_ch=${market}_${stockId}.tw&json=1&delay=0&_=${ts}`;

    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];
    if (!info) return null;

    return {
      type: "stock",
      market,
      id: info.c,
      name: info.n,
      price: num(info.z),
      yPrice: num(info.y),
      open: num(info.o),
      high: num(info.h),
      low: num(info.l),
      vol: num(info.v),
      time: info.t,
      url: "https://mis.twse.com.tw/"
    };
  } catch {
    return null;
  }
}

// ======================================================
// 3️⃣ 台指期（TXF）— 鉅亨網 API（支援夜盤）
// ======================================================
async function getTaiwanFutures() {
  // 鉅亨網：台指期近月（連續）
  // 日盤 / 夜盤 都會即時更新
  const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TWS:TXF";

  try {
    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    const price = num(info.c);    // 現價
    const change = num(info.ch);  // 漲跌
    const yPrice = price !== null && change !== null
      ? price - change
      : null;

    return {
      type: "index",
      id: "TXF",
      name: "台指期",
      price,
      yPrice,
      open: num(info.o),
      high: num(info.h),
      low: num(info.l),
      time: new Date(info.t * 1000).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Taipei"
      }),
      url: "https://invest.cnyes.com/futures/TWS/TXF"
    };
  } catch (err) {
    console.error("❌ Anue TXF Error", err.message);
    return null;
  }
}

// ======================================================
// 🔥 單一對外入口（index.js 只呼叫這裡）
// ======================================================
async function getStockQuote(input) {
  const key = String(input).trim();

  // 台指期（含夜盤）
  if (["台指期", "台指", "TXF"].includes(key)) {
    return await getTaiwanFutures();
  }

  // 櫃買指數
  if (["櫃買", "OTC", "櫃買指數"].includes(key)) {
    return await getOfficialIndex("OTC");
  }

  // 加權指數
  if (["大盤", "加權", "加權指數"].includes(key)) {
    return await getOfficialIndex("TWII");
  }

  // 個股（上市 → 上櫃）
  if (isStockId(key)) {
    let data = await getTWSELikeQuote(key, "tse");
    if (data && data.price !== null) return data;

    data = await getTWSELikeQuote(key, "otc");
    if (data && data.price !== null) return data;

    return null;
  }

  return null;
}

module.exports = { getStockQuote };
