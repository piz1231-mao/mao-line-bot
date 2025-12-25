// ======================================================
// 📊 Stock Service v1.7.1（台指期最終修正版）
// ------------------------------------------------------
// ✔ 個股（上市 / 上櫃）：TWSE 官方 API
// ✔ 櫃買指數 / 加權指數：TWSE 官方 API
// ✔ 台指期（含夜盤）：鉅亨網 API（TXF00）
// ======================================================

const axios = require("axios");

// ------------------------------------------------------
const isStockId = (v) => /^\d{4}$/.test(v);

const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ======================================================
// 官方指數（加權 / 櫃買）
// ======================================================
async function getOfficialIndex(type) {
  try {
    const ts = Date.now();
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
      price: num(info.z),
      yPrice: num(info.y),
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
// 官方個股（上市 / 上櫃）
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
// 台指期（TXF00｜鉅亨網｜含夜盤）
// ======================================================
async function getTaiwanFutures() {
  // ⚠️ 正確代號：TXF00（連續近月）
  const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TWS:TXF00";

  try {
    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    const price = num(info.c);
    const change = num(info.ch);
    const yPrice =
      price !== null && change !== null ? price - change : null;

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
// 單一入口
// ======================================================
async function getStockQuote(input) {
  const key = String(input).trim();

  if (["台指期", "台指", "TXF"].includes(key)) {
    return await getTaiwanFutures();
  }

  if (["櫃買", "OTC", "櫃買指數"].includes(key)) {
    return await getOfficialIndex("OTC");
  }

  if (["大盤", "加權", "加權指數"].includes(key)) {
    return await getOfficialIndex("TWII");
  }

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
