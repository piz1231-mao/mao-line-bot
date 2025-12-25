// ======================================================
// 📊 Stock Service（官方 API + 台指期鉅亨版）
// ------------------------------------------------------
// 支援：
// - 上市 / 上櫃個股（TWSE 官方 API）
// - 加權指數 / 櫃買指數（TWSE 官方 API）
// - 台指期 TXF（鉅亨網 API，不擋 Render）
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
      time: info.t
    };
  } catch (e) {
    console.error("❌ Index error:", e.message);
    return null;
  }
}

// ======================================================
// 2️⃣ 官方個股（上市 / 上櫃）
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
// 3️⃣ 台指期 TXF（鉅亨網 API）
// ======================================================
async function getTXFQuote() {
  try {
    const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    // 鉅亨欄位對應（你已確認正確）
    const price  = num(info["6"]);   // 成交
    const open   = num(info["19"]);  // 開盤
    const high   = num(info["12"]);  // 最高
    const low    = num(info["13"]);  // 最低
    const change = num(info["11"]);  // 漲跌
    const percent = num(info["56"]); // 漲幅 %
    const vol    = num(info["200013"]); // 總量
    const timeTs = info["200007"];   // 時間戳

    return {
      type: "future",
      id: "TXF",
      name: "台指期",
      price,
      change,
      percent,
      open,
      high,
      low,
      vol,
      time: new Date(timeTs * 1000).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Taipei"
      })
    };
  } catch (e) {
    console.error("❌ TXF error:", e.message);
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
    return await getTXFQuote();
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
  }

  return null;
}

module.exports = { getStockQuote };
