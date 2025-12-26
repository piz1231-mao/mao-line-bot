// ======================================================
// 📊 Stock Service v2.5.0（最佳五檔救援版）
// ------------------------------------------------------
// 邏輯升級：
// 1. 優先用 z (成交價)。
// 2. 沒 z，嘗試抓 b (買一) 或 a (賣一) -> 這就是盤中即時行情！
// 3. 都沒有，才用 y (昨收) -> 這只有在未開盤或暫停交易時才會發生。
// ======================================================

const axios = require("axios");

// 記住最後價格 (輔助用)
const lastPriceCache = {};
 
// ------------------ 工具 ------------------
const num = (v) => {
  if (v === undefined || v === null || v === "-" || v === "null") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
};

const isStockId = (v) => /^\d{4}$/.test(v);

// ------------------ TWSE / OTC ------------------
async function getTWSEQuote(url, id, fixedName, type) {
  try {
    const { data } = await axios.get(url);
    const info = data?.msgArray?.[0];

    // 沒資料或沒名稱 = 這個市場沒有這支
    if (!info || !info.n) return null;

    const stockId = info.c || id;
    let z = num(info.z); // 成交價
    const y = num(info.y); // 昨收

    // 🔥【關鍵救援】若無成交價，改抓「買一」或「賣一」
    if (z === null) {
        // info.b 格式通常是 "1049.00_1048.00_..." (最佳五檔買入)
        if (info.b && info.b !== "-") {
            const bids = info.b.split("_");
            if (bids[0]) z = num(bids[0]); // 抓買一
        }
        
        // 如果連買單都沒有，抓賣單 (info.a)
        if (z === null && info.a && info.a !== "-") {
            const asks = info.a.split("_");
            if (asks[0]) z = num(asks[0]); // 抓賣一
        }
    }

    // ===== 價格決定 =====
    let price = null;

    if (z !== null) {
      price = z;
      lastPriceCache[stockId] = z; // 更新快取
    } else if (lastPriceCache[stockId] !== undefined) {
      price = lastPriceCache[stockId]; // 用上一筆快取
    } else {
      price = y; // 真的都沒有，才用昨收 (極少發生)
    }

    // ===== 漲跌計算 =====
    let change = 0;
    let percent = 0;

    if (price !== null && y !== null) {
      change = price - y;
      percent = (change / y) * 100;
    }

    return {
      type: type,
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

// ------------------ 台指期 TXF (鉅亨網) ------------------
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

// ------------------ 主入口 ------------------
async function getStockQuote(input) {
  const key = String(input).trim();
  const ts = Date.now();

  if (["TXF", "台指期", "台指"].includes(key)) {
    return await getTXFQuote();
  }

  if (["加權", "加權指數", "大盤", "TWII"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_t00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "TWII", "加權指數", "index");
  }

  if (["櫃買", "櫃買指數", "OTC"].includes(key)) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_o00.tw&json=1&delay=0&_=${ts}`;
    return await getTWSEQuote(url, "OTC", "櫃買指數", "index");
  }

  if (isStockId(key)) {
    // 1. 查上市 (嚴格檢查有沒有名稱)
    let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${key}.tw&json=1&delay=0&_=${ts}`;
    let data = await getTWSEQuote(url, key, null, "stock");
    if (data) return data;

    // 2. 查上櫃
    url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${key}.tw&json=1&delay=0&_=${ts}`;
    data = await getTWSEQuote(url, key, null, "stock");
    if (data) return data;
  }

  return null;
}

module.exports = { getStockQuote };
