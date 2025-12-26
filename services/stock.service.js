// ======================================================
// 📊 Stock Service v2.5.0（盤中即時定版）
// ------------------------------------------------------
// 價位優先序：
// 1️⃣ p（盤中即時撮合價）
// 2️⃣ z（最後成交價）
// 3️⃣ y（昨收，只顯示不計算）
// ======================================================

const axios = require("axios");

const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// ======================================================
// 📈 TWSE / OTC（股票 / 指數）
// ======================================================
async function getTWSEQuote(url, id, fixedName) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];
    if (!info || !info.n) return null;

    const p = num(info.p); // 🔥 盤中即時撮合價
    const z = num(info.z); // 最後成交
    const y = num(info.y); // 昨收

    // 👉 現價顯示邏輯
    const price =
      p !== null ? p :
      z !== null ? z :
      y;

    let change = null;
    let percent = null;

    // 👉 漲跌只用「真的盤中價」
    const base = p !== null ? p : z;

    if (base !== null && y !== null) {
      change = base - y;
      percent = (change / y) * 100;
    }

    return {
      id: info.c || id,
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
  } catch (e) {
    return null;
  }
}

// ======================================================
// 📊 台指期 TXF（維持原邏輯，鉅亨是即時）
// ======================================================
async function getTXFQuote() {
  try {
    const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
    const { data } = await axios.get(url);
    const info = data?.data?.[0];
    if (!info) return null;

    return {
      id: "TXF",
      name: "台指期",
      price: num(info["6"]),
      change: num(info["11"]),
      percent: num(info["56"]),
      open: num(info["19"]),
      high: num(info["12"]),
      low: num(info["13"]),
      vol: num(info["200013"]),
      time: new Date(info["200007"] * 1000).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Taipei"
      })
    };
  } catch (e) {
    return null;
  }
}

// ======================================================
// 🔥 主入口
// ======================================================
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
