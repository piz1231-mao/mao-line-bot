// ======================================================
// 📊 Stock Service（定版 v1.0）
// ------------------------------------------------------
// 規則：
// 1. 所有回傳物件都包含：
//    id, name, price, yPrice, change, percent
// 2. 指數名稱用「自定義名稱」
// 3. 個股名稱用 API 回傳
// 4. 台指期直接吃 API 給的 change / percent
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
  const { data } = await axios.get(url);
  const info = data?.msgArray?.[0];
  if (!info) return null;

  const price = num(info.z);
  const yPrice = num(info.y);

  let change = null;
  let percent = null;
  if (price !== null && yPrice !== null) {
    change = price - yPrice;
    percent = (change / yPrice) * 100;
  }

  return {
    id,
    name: fixedName || info.n, // 🔥 關鍵：指數用固定名
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
}

// ------------------ 台指期 TXF ------------------
async function getTXFQuote() {
  const url = "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
  const { data } = await axios.get(url);
  const info = data?.data?.[0];
  if (!info) return null;

  const price = num(info["6"]);
  const change = num(info["11"]);   // API 已給
  const percent = num(info["56"]);  // API 已給

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
    let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null);
    if (data?.price !== null) return data;

    url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null);
    if (data?.price !== null) return data;
  }

  return null;
}

module.exports = { getStockQuote };
