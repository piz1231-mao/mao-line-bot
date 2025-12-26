// ======================================================
// 📊 Stock Service（盤中即時最終定版）
// - 解決 TWSE 盤中 z = "-" 問題
// - 使用「最後一筆有效成交價」
// ======================================================

const axios = require("axios");

// 🔥 記住盤中最後一筆有效成交價
const lastPriceCache = {};

// ------------------ 工具 ------------------
const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// ------------------ TWSE / OTC ------------------
async function getTWSEQuote(url, id, fixedName) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];

    // 沒資料或沒名稱 = 這個市場沒有這支
    if (!info || !info.n) return null;

    const stockId = info.c || id;
    const z = num(info.z); // 成交價
    const y = num(info.y); // 昨收

    // ===== 現價判斷 =====
    let price = null;

    if (z !== null) {
      price = z;
      lastPriceCache[stockId] = z; // 🔥 記住最後成交
    } else if (lastPriceCache[stockId] !== undefined) {
      price = lastPriceCache[stockId]; // 🔥 沿用上一筆
    }

    // ===== 漲跌 =====
    let change = null;
    let percent = null;

    if (price !== null && y !== null) {
      change = price - y;
      percent = (change / y) * 100;
    }

    return {
      id: stockId,
      name: fixedName || info.n,
      price,
      yPrice: y,
      change,
      percent,
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

// ------------------ 台指期 TXF ------------------
async function getTXFQuote() {
  try {
    const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    const price = num(info["6"]);
    const change = num(info["11"]);
    const percent = num(info["56"]);

    return {
      id: "TXF",
      name: "台指期",
      price,
      yPrice: price !== null && change !== null ? price - change : null,
      change,
      percent,
      open: num(info["19"]),
      high: num(info["12"]),
      low: num(info["13"]),
      vol: num(info["200013"]),
      time: new Date(info["200007"] * 1000).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit"
      })
    };
  } catch {
    return null;
  }
}

// ------------------ 主入口 ------------------
async function getStockQuote(input) {
  const key = String(input).trim();
  const ts = Date.now();

  if (["TXF", "台指期", "台指"].includes(key)) {
    return await getTXFQuote();
  }

  if (["加權", "加權指數", "大盤", "TWII"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "TWII", "加權指數");
  }

  if (["櫃買", "櫃買指數", "OTC"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "OTC", "櫃買指數");
  }

  if (isStockId(key)) {
    let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null);
    if (data) return data;

    url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null);
    if (data) return data;
  }

  return null;
}

module.exports = { getStockQuote };
