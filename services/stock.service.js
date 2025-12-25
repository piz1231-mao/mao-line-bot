// ======================================================
// 📊 Stock Service（定版 v1.0）
// ======================================================

const axios = require("axios");

const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// ======================================================
// 📌 TWSE / OTC 共用
// ======================================================
async function getTWSE(url, id, name) {
  const { data } = await axios.get(url);
  const info = data?.msgArray?.[0];
  if (!info) return null;

  const price = num(info.z);
  const yPrice = num(info.y);

  const change =
    price !== null && yPrice !== null ? price - yPrice : null;
  const percent =
    change !== null && yPrice ? (change / yPrice) * 100 : null;

  return {
    id: info.c || id,
    name: info.n || name,
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

// ======================================================
// 📈 台指期（鉅亨網）
// ======================================================
async function getTXF() {
  const url =
    "https://ws.api.cnyes.com/ws/api/v1/quote/quotes/TFE:TXF:FUTURE";
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
    yPrice: price - change,
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

// ======================================================
// 🔥 對外主入口
// ======================================================
async function getStockQuote(input) {
  const key = String(input).trim();
  const ts = Date.now();

  if (["台指期", "台指", "TXF"].includes(key)) {
    return await getTXF();
  }

  if (["加權", "大盤", "加權指數"].includes(key)) {
    return await getTWSE(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&_=${ts}`,
      "TWII",
      "加權指數"
    );
  }

  if (["櫃買", "OTC", "櫃買指數"].includes(key)) {
    return await getTWSE(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw&_=${ts}`,
      "OTC",
      "櫃買指數"
    );
  }

  if (isStockId(key)) {
    let data = await getTWSE(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&_=${ts}`,
      key,
      ""
    );
    if (data?.price !== null) return data;

    data = await getTWSE(
      `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&_=${ts}`,
      key,
      ""
    );
    return data;
  }

  return null;
}

module.exports = { getStockQuote };
