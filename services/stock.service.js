// ======================================================
// 📊 Stock Service v2.6.0（最終定版）
// ------------------------------------------------------
// ✔ 盤中即時：成交價 z → 買一 b → 賣一 a → 快取 → 昨收
// ✔ 指數代號固定：TWII / OTC 不被 API 蓋掉
// ✔ 個股名稱嚴格檢查，避免 undefined
// ✔ 不再出現 -100% / 0 價格假象
// ======================================================

const axios = require("axios");

// ------------------------------------------------------
// 🔧 工具
// ------------------------------------------------------
const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// 快取最後有效價格（盤中救援）
const lastPriceCache = {};

// ------------------------------------------------------
// 📈 TWSE / OTC（股票＋指數）
// ------------------------------------------------------
async function getTWSEQuote(url, id, fixedName, type) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];

    // 🚫 沒資料或沒名稱 = 無效（防止空殼）
    if (!info || !info.n) return null;

    const stockId = id; // 🔥 關鍵：顯示代號一律用「我們傳進來的」
    const y = num(info.y); // 昨收
    let z = num(info.z);   // 成交價

    // --------------------------------------------------
    // 🧠 盤中救援邏輯
    // --------------------------------------------------
    if (z === null) {
      // 買一
      if (info.b && info.b !== "-") {
        const bids = info.b.split("_");
        if (bids[0]) z = num(bids[0]);
      }
      // 賣一
      if (z === null && info.a && info.a !== "-") {
        const asks = info.a.split("_");
        if (asks[0]) z = num(asks[0]);
      }
    }

    // --------------------------------------------------
    // 💰 價格最終決策
    // --------------------------------------------------
    let price = null;

    if (z !== null) {
      price = z;
      lastPriceCache[stockId] = z;
    } else if (lastPriceCache[stockId] !== undefined) {
      price = lastPriceCache[stockId];
    } else {
      price = y; // 最後 fallback（未開盤 / 暫停）
    }

    // --------------------------------------------------
    // 📊 漲跌計算（只有在合理時）
    // --------------------------------------------------
    let change = 0;
    let percent = 0;

    if (price !== null && y !== null) {
      change = price - y;
      percent = (change / y) * 100;
    }

    return {
      type,
      id: stockId,                 // ✅ 不再用 info.c
      name: fixedName || info.n,   // 指數用固定名，個股用 API
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
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------
// 📊 台指期 TXF（鉅亨網）
// ------------------------------------------------------
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
  } catch {
    return null;
  }
}

// ------------------------------------------------------
// 🚪 主入口
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
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "TWII", "加權指數", "index");
  }

  // 櫃買指數
  if (["櫃買", "櫃買指數", "OTC"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "OTC", "櫃買指數", "index");
  }

  // 個股
  if (isStockId(key)) {
    // 上市
    let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null, "stock");
    if (data) return data;

    // 上櫃
    url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null, "stock");
    if (data) return data;
  }

  return null;
}

module.exports = { getStockQuote };
