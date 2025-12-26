// ======================================================
// 📊 Stock Service v2.5.1（盤中即時穩定版｜定版）
// ------------------------------------------------------
// 職責：
// - 只做「資料取得」
// - 股票 / 指數 / 台指期
// - 盤中沒成交 → 用買一 / 賣一救援
// - 絕不輸出 Flex / UI
//
// 對應 index.js：
// const { getStockQuote } = require("./services/stock.service");
// ======================================================

const axios = require("axios");

// ------------------------------------------------------
// 工具
// ------------------------------------------------------
const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// 快取最後一筆盤中價格（避免瞬斷）
const lastPriceCache = {};

// ------------------------------------------------------
// TWSE / OTC（股票＋指數）
// ------------------------------------------------------
async function getTWSEQuote(url, fixedId, fixedName, type) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];

    // 沒資料 or 沒名稱 = 此市場不存在
    if (!info || !info.n) return null;

    const id = info.c || fixedId;
    const y = num(info.y); // 昨收
    let z = num(info.z);   // 成交價

    // ===== 盤中救援邏輯 =====
    if (z === null) {
      // 買一
      if (info.b && info.b !== "-") {
        const bid = num(info.b.split("_")[0]);
        if (bid !== null) z = bid;
      }
      // 賣一
      if (z === null && info.a && info.a !== "-") {
        const ask = num(info.a.split("_")[0]);
        if (ask !== null) z = ask;
      }
    }

    // 最終價格決定
    let price = null;
    if (z !== null) {
      price = z;
      lastPriceCache[id] = z;
    } else if (lastPriceCache[id] !== undefined) {
      price = lastPriceCache[id];
    } else {
      price = y;
    }

    // 漲跌計算
    let change = 0;
    let percent = 0;
    if (price !== null && y !== null) {
      change = price - y;
      percent = (change / y) * 100;
    }

    return {
      type,                 // stock | index
      id,
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
  } catch (err) {
    return null;
  }
}

// ------------------------------------------------------
// 台指期 TXF（鉅亨網）
// ------------------------------------------------------
async function getTXFQuote() {
  try {
    const url =
      "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    const price = num(info["6"]);
    const change = num(info["11"]);
    const percent = num(info["56"]);

    return {
      type: "future",
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
  } catch (err) {
    return null;
  }
}

// ------------------------------------------------------
// 🔥 主入口（index.js 唯一會用到的）
// ------------------------------------------------------
async function getStockQuote(input) {
  const key = String(input).trim();
  const ts = Date.now();

  // 台指期
  if (["TXF", "台指期", "台指"].includes(key)) {
    return await getTXFQuote();
  }

  // 加權指數
  if (["加權", "加權指數", "大盤", "TWII"].includes(key)) {
    const url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?` +
      `ex_ch=tse_t00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "TWII", "加權指數", "index");
  }

  // 櫃買指數
  if (["櫃買", "櫃買指數", "OTC"].includes(key)) {
    const url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?` +
      `ex_ch=otc_o00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "OTC", "櫃買指數", "index");
  }

  // 個股
  if (isStockId(key)) {
    // 先查上市
    let url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?` +
      `ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null, "stock");
    if (data) return data;

    // 再查上櫃
    url =
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?` +
      `ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null, "stock");
    if (data) return data;
  }

  return null;
}

// ------------------------------------------------------
module.exports = { getStockQuote };
console.log("🧪 stock.service exports =", module.exports);
