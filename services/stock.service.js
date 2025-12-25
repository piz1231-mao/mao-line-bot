// ======================================================
// 📊 Stock Service v1.9.0（正式定版）
// ------------------------------------------------------
// ✔ 個股（上市 / 上櫃）：TWSE 官方 MIS API
// ✔ 櫃買指數 / 加權指數：TWSE 官方 MIS API
// ✔ 台指期（TXF）：鉅亨網 JSON API（TFE:TXF:FUTURE）
// ❌ 不使用 Yahoo、不用爬蟲
// ======================================================

const axios = require("axios");

// ------------------------------------------------------
// 工具
// ------------------------------------------------------
const isStockId = (v) => /^\d{4}$/.test(v);

const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

// ======================================================
// 1️⃣ TWSE 官方指數（加權 / 櫃買）
// ======================================================
async function getOfficialIndex(type) {
  try {
    const ts = Date.now();
    const code = type === "OTC" ? "otc_o00.tw" : "tse_t00.tw";
    const name = type === "OTC" ? "櫃買指數" : "加權指數";

    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${code}&json=1&delay=0&_=${ts}`;
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
    console.error(`❌ TWSE Index Error (${type})`, err.message);
    return null;
  }
}

// ======================================================
// 2️⃣ TWSE 官方個股（上市 / 上櫃）
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
      time: info.t,
      url: "https://mis.twse.com.tw/"
    };
  } catch {
    return null;
  }
}

// ======================================================
// 3️⃣ 台指期（鉅亨網 JSON API）✅
// ======================================================
async function getTaiwanFutures() {
  try {
    const url =
      "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";

    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    // 鉅亨欄位對照（你剛剛貼的 JSON）
    const price = num(info["6"]);   // 現價
    const open  = num(info["12"]);  // 開盤
    const high  = num(info["75"]);  // 最高
    const low   = num(info["76"]);  // 最低
    const yPrice = num(info["13"]); // 昨收

    return {
      type: "index",
      id: "TXF",
      name: "台指期",
      price,
      yPrice,
      open,
      high,
      low,
      time: new Date(info["200007"] * 1000).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Taipei"
      }),
      url: "https://invest.cnyes.com/futures/TFE/TXF"
    };
  } catch (err) {
    console.error("❌ TXF (Anue) Error:", err.message);
    return null;
  }
}

// ======================================================
// 🔥 單一入口（index.js 只呼叫這個）
// ======================================================
async function getStockQuote(input) {
  const key = String(input).trim();

  // 台指期
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
