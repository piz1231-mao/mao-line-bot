// ======================================================
// 📊 Stock Service v2.3.0（盤中最終定版）
// ------------------------------------------------------
// 核心原則：
// 1️⃣ API 有資料就回（不因盤中 z 為 '-' 判死刑）
// 2️⃣ 成交價優先順序：z → p → y
// 3️⃣ 漲跌/幅度只在「可算」時才算
// 4️⃣ 絕不製造假 0%、假 -100%
// ======================================================

const axios = require("axios");

// ------------------ 工具 ------------------
const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// ======================================================
// 📈 TWSE / OTC（個股 / 指數）
// ======================================================
async function getTWSEQuote(url, id, fixedName) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];

    // ❌ 完全沒資料才算查無
    if (!info || !info.n) return null;

    const z = num(info.z); // 即時成交
    const p = num(info.p); // 試撮合 / 最近價
    const y = num(info.y); // 昨收

    // ✅ 成交價選擇邏輯（非常關鍵）
    const price =
      z !== null ? z :
      p !== null ? p :
      y !== null ? y :
      null;

    let change = null;
    let percent = null;

    if (price !== null && y !== null) {
      change = price - y;
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
// 📊 台指期 TXF（鉅亨）
// ======================================================
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

  // 台指期
  if (["TXF", "台指期", "台指"].includes(key)) {
    return await getTXFQuote();
  }

  // 加權指數
  if (["加權", "加權指數", "大盤", "TWII"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "TWII", "加權指數");
  }

  // 櫃買指數
  if (["櫃買", "櫃買指數", "OTC"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "OTC", "櫃買指數");
  }

  // 個股
  if (isStockId(key)) {
    // 先查上市
    let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null);
    if (data) return data;

    // 再查上櫃
    url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null);
    if (data) return data;
  }

  return null;
}

module.exports = { getStockQuote };
