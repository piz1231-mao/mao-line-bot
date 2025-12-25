// ======================================================
// 📊 Stock Service（最終定版）
// ------------------------------------------------------
// 支援：
// - 上市股票（TWSE）
// - 上櫃股票（OTC）
// - 台指期（TXF）
// - 櫃買指數（^TWO）
// - 加權指數（^TWII）
//
// 使用者無須知道市場別或代號
// ======================================================

const axios = require("axios");

const isStockId = (v) => /^\d{4}$/.test(v);

const num = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ======================================================
// 指數 / 期貨（Yahoo Chart API）
// ======================================================
async function getIndexQuote(yahooSymbol, displayName) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`;
    const { data } = await axios.get(url);

    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;

    return {
      type: "index",
      id: yahooSymbol,
      name: displayName,
      price: meta.regularMarketPrice,
      yPrice: meta.previousClose,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      open: meta.regularMarketOpen,
      time: new Date(meta.regularMarketTime * 1000)
        .toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
    };
  } catch (err) {
    console.error("❌ Index fetch error:", err.message);
    return null;
  }
}

// ======================================================
// 上市 / 上櫃股票（TWSE API）
// ======================================================
async function getTWSELikeQuote(stockId, market) {
  try {
    const ts = Date.now();
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${market}_${stockId}.tw&json=1&delay=0&_=${ts}`;

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
      time: info.t
    };
  } catch {
    return null;
  }
}

// ======================================================
// 🔥 單一入口（index.js 只會呼叫這個）
// ======================================================
async function getStockQuote(input) {
  const key = input.trim();

  // ===== 指數 / 期貨關鍵字翻譯 =====
  if (["台指期", "台指", "TXF"].includes(key)) {
    return await getIndexQuote("WTX%26", "台指期");
  }

  if (["櫃買", "OTC", "櫃買指數"].includes(key)) {
    return await getIndexQuote("^TWO", "櫃買指數");
  }

  if (["大盤", "加權"].includes(key)) {
    return await getIndexQuote("^TWII", "加權指數");
  }

  // ===== 個股（四碼，不分上市上櫃）=====
  if (isStockId(key)) {
    let data = await getTWSELikeQuote(key, "tse");
    if (data) return data;

    data = await getTWSELikeQuote(key, "otc");
    if (data) return data;

    return null;
  }

  return null;
}

module.exports = { getStockQuote };
