// ======================================================
// 📊 Stock Service v2.3.0（盤中穩定最終版）
// ------------------------------------------------------
// 設計原則：
// 1. 成交價 z 若不存在（盤中瞬間無成交）
//    → 以昨收 y 作為顯示價
// 2. 漲跌 / 漲跌幅一律用「顯示價 price」計算
// 3. 嚴格避免：
//    - undefined 名稱
//    - -100% 假暴跌
//    - 盤中查無資料
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
// TWSE / OTC（指數 + 個股）
// ======================================================
async function getTWSEQuote(url, id, fixedName) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];

    // 🚨 沒資料或沒名稱 → 視為不存在
    if (!info || !info.n) return null;

    const tradePrice = num(info.z); // 即時成交價（可能為 null）
    const yPrice = num(info.y);     // 昨收（一定有）

    // ⭐ 核心邏輯：成交價沒有時，用昨收當顯示價
    const price =
      tradePrice !== null
        ? tradePrice
        : yPrice !== null
          ? yPrice
          : null;

    let change = 0;
    let percent = 0;

    if (price !== null && yPrice !== null) {
      change = price - yPrice;
      percent = (change / yPrice) * 100;
    }

    return {
      id: info.c || id,
      name: fixedName || info.n,
      price,           // ⭐ 顯示用價格（永遠不會是 0 假跌）
      yPrice,
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

// ======================================================
// 台指期 TXF（鉅亨 API，本身就穩定）
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
  } catch (err) {
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
