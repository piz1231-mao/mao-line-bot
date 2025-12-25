// services/stock.service.js
// 雙核心版：
// 1. 股票/大盤 -> 查證交所 (TWSE)
// 2. 台指期 -> 查期交所 (TAIFEX)

const axios = require("axios");

// ==========================================
// 核心 1：查期貨 (來源：台灣期交所 TAIFEX)
// ==========================================
async function getFuturesQuote() {
  try {
    const url = "https://mis.taifex.com.tw/futures/api/getQuoteList";
    const body = {
      "MarketType": "0",
      "SymbolType": "F",
      "KindID": "1",
      "CID": "TXF", // TXF = 台指期
      "ExpireMonth": "" // 空白代表抓近月
    };

    // 必須加上 Header 偽裝成瀏覽器，不然期交所會擋
    const res = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    const list = res.data?.QuoteList;
    if (!list || list.length === 0) return null;

    // 抓第一筆，通常就是「近月」合約 (例如 TXF01)
    const info = list[0]; 
    
    // 整理格式 (期交所的欄位名稱跟證交所不一樣)
    const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));

    return {
      id: info.DispCName,       // 顯示名稱 (例如: 臺指期015)
      name: "台指期(近月)",      // 我們自己取名
      price: safeNum(info.LastPrice), // 最新成交價
      yPrice: safeNum(info.RefPrice), // 參考價(昨收/開盤參考)
      high: safeNum(info.HighPrice),  // 最高
      low: safeNum(info.LowPrice),    // 最低
      open: safeNum(info.OpenPrice),  // 開盤
      vol: safeNum(info.TotalVolume), // 總成交量
      time: info.Time              // 時間
    };

  } catch (err) {
    console.error("❌ 期貨 API Error:", err.message);
    return null;
  }
}

// ==========================================
// 核心 2：查股票 (來源：證交所 TWSE)
// ==========================================
async function getTwseQuote(targetId) {
  const t = new Date().getTime();
  const targets = [`tse_${targetId}.tw`, `otc_${targetId}.tw`];

  for (const target of targets) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${target}&json=1&delay=0&_=${t}`;
    try {
      const res = await axios.get(url);
      const data = res.data;
      if (data.msgArray && data.msgArray.length > 0) {
        const info = data.msgArray[0];
        const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));
        return {
          id: info.c,
          name: info.n,
          price: safeNum(info.z),
          yPrice: safeNum(info.y),
          high: safeNum(info.h),
          low: safeNum(info.l),
          open: safeNum(info.o),
          vol: safeNum(info.v),
          time: info.t
        };
      }
    } catch (e) { continue; }
  }
  return null;
}

// ==========================================
// 主入口：自動判斷要查誰
// ==========================================
async function getStockQuote(stockId) {
  let id = stockId.toUpperCase().trim();

  // 1. 如果是查台指期，走期交所通道
  const futuresKeywords = ["台指", "台指期", "台指近", "台指近全", "TXF1", "TXF"];
  if (futuresKeywords.includes(id)) {
    return await getFuturesQuote();
  }

  // 2. 如果是查大盤，代號轉成 t00
  if (["大盤", "加權指數"].includes(id)) {
    id = "t00";
  }

  // 3. 其他都走證交所通道 (股票、大盤)
  return await getTwseQuote(id);
}

module.exports = { getStockQuote };
