// ======================================================
// 📊 Stock Service v2.1.0（盤中修正版）
// ------------------------------------------------------
// 修正說明：
// 放寬個股判斷邏輯。只要代號存在於該市場（TSE/OTC），
// 即便盤中短暫沒有成交價（price 為 null），也要回傳資料，
// 避免因為沒有成交價而誤判為「查無此股」。
// ======================================================

const axios = require("axios");

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
    
    // 如果 info 不存在，代表該市場沒這支股票
    if (!info) return null;

    const price = num(info.z);  // 成交價
    const yPrice = num(info.y); // 昨收

    let change = null;
    let percent = null;
    
    // 只有當現價與昨收都有值時，才計算漲跌
    if (price !== null && yPrice !== null) {
      change = price - yPrice;
      percent = (change / yPrice) * 100;
    }

    return {
      id: info.c || id,
      name: fixedName || info.n,
      price,
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

// ------------------ 台指期 TXF ------------------
async function getTXFQuote() {
  const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
  try {
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
  } catch (err) {
    return null;
  }
}

// ------------------ 主入口 ------------------
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
    // 1. 先查上市
    let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null);
    
    // 🔥 修正重點：只要 data 存在（代表代號正確），就直接回傳，不管 price 是不是 null
    if (data) return data;

    // 2. 查不到才查上櫃
    url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null);
    
    // 同理，只要有資料就回傳
    if (data) return data;
  }

  return null;
}

module.exports = { getStockQuote };
