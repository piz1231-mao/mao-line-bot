// ======================================================
// 📊 Stock Service（最終定版）
// ------------------------------------------------------
// 支援：
// - 上市股票（TWSE 官方 MIS）
// - 上櫃股票（OTC 官方 MIS）
// - 加權指數（TWII｜官方 MIS）
// - 櫃買指數（OTC Index｜官方 MIS）
// - 台指期（TXF｜Yahoo Chart API 主力連續月）
//
// index.js 僅需呼叫 getStockQuote()
// 使用者不需知道市場別或代號
// ======================================================

const axios = require("axios");

// ======================================================
// 工具
// ======================================================
const isStockId = (v) => /^\d{4}$/.test(v);

const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ======================================================
// 1️⃣ 官方 MIS：加權指數 / 櫃買指數（最穩）
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
      market: type,
      id: code,
      name,
      price: num(info.z),
      yPrice: num(info.y),
      open: num(info.o),
      high: num(info.h),
      low: num(info.l),
      vol: null,
      time: info.t,
      url: "https://mis.twse.com.tw/"
    };
  } catch (err) {
    console.error("❌ Official Index Error:", err.message);
    return null;
  }
}

// ======================================================
// 2️⃣ 台指期 TXF（Yahoo Chart API｜主力連續月）
// ======================================================
async function getTaiwanFutures() {
  try {
    // 主力連續月（唯一正確）
    const symbol = "TXF=F";
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}` +
      `?interval=1m&range=1d`;

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      }
    });

    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;

    return {
      type: "index",
      market: "FUTURES",
      id: "TXF",
      name: "台指期",
      price: meta.regularMarketPrice,
      yPrice: meta.previousClose,
      open: meta.regularMarketOpen,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      vol: null,
      time: new Date(meta.regularMarketTime * 1000)
        .toLocaleTimeString("zh-TW", {
          hour: "2-digit",
          minute: "2-digit"
        }),
      url: "https://finance.yahoo.com/quote/TXF=F"
    };
  } catch (err) {
    console.error("❌ TXF Chart API Error:", err.message);
    return null;
  }
}

// ======================================================
// 3️⃣ 官方 MIS：上市 / 上櫃個股
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
// 🔥 對外唯一入口（index.js 只呼叫這個）
// ======================================================
async function getStockQuote(input) {
  const key = input.trim();

  // ---- 台指期 ----
  if (["台指期", "台指", "TXF"].includes(key)) {
    return await getTaiwanFutures();
  }

  // ---- 櫃買指數 ----
  if (["櫃買", "OTC", "櫃買指數"].includes(key)) {
    return await getOfficialIndex("OTC");
  }

  // ---- 加權指數 ----
  if (["大盤", "加權", "加權指數"].includes(key)) {
    return await getOfficialIndex("TWII");
  }

  // ---- 個股（四碼，自動判斷上市 / 上櫃）----
  if (isStockId(key)) {
    let data = await getTWSELikeQuote(key, "tse"); // 上市
    if (data && data.price !== null) return data;

    data = await getTWSELikeQuote(key, "otc"); // 上櫃
    if (data && data.price !== null) return data;

    return null;
  }

  return null;
}

module.exports = { getStockQuote };
