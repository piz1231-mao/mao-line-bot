// ======================================================
// 📊 Stock Service（最終定版）
// ------------------------------------------------------
// 功能說明：
// - 單一入口 getStockQuote(symbol)
// - 自動判斷：
//   1️⃣ 台指期 / 指數
//   2️⃣ 上市股票（TWSE）
//   3️⃣ 上櫃股票（OTC）
// - 使用者無須知道市場別
//
// 設計原則：
// - Router 不動
// - 指令不變
// - 所有市場判斷只在這個檔案內
// ======================================================

const axios = require("axios");

// ======================================================
// 工具
// ======================================================
const isStockId = (v) => /^\d{4}$/.test(v);
const isIndex = (v) =>
  ["台指", "台指期", "txf", "TXF"].includes(v);

// 安全轉數字
const num = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ======================================================
// 1️⃣ 台指期（期貨）
// ======================================================
async function getTXFQuote() {
  try {
    // Yahoo 台指期（TXF）
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/WTX%26";
    const { data } = await axios.get(url);

    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;

    return {
      type: "index",
      id: "TXF",
      name: "台指期",
      price: meta.regularMarketPrice,
      yPrice: meta.previousClose,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      open: meta.regularMarketOpen,
      time: new Date(meta.regularMarketTime * 1000)
        .toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
    };
  } catch (err) {
    console.error("❌ TXF fetch error:", err.message);
    return null;
  }
}

// ======================================================
// 2️⃣ 上市 / 上櫃（TWSE / OTC 共用）
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
  } catch (err) {
    return null;
  }
}

// ======================================================
// 🔥 單一入口（給 index.js 用）
// ======================================================
async function getStockQuote(symbol) {
  const key = symbol.trim();

  // ===== 1️⃣ 台指期 =====
  if (isIndex(key)) {
    return await getTXFQuote();
  }

  // ===== 2️⃣ 四碼股票（先上市 → 再上櫃）=====
  if (isStockId(key)) {
    // 先查上市
    let data = await getTWSELikeQuote(key, "tse");
    if (data) return data;

    // 再查上櫃
    data = await getTWSELikeQuote(key, "otc");
    if (data) return data;

    return null;
  }

  return null;
}

module.exports = { getStockQuote };
