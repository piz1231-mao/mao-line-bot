// services/stock.service.js
// 使用台灣證券交易所 (TWSE) 基本市況報導網站 API
// 優點：免 Token、免算日期、假日也能查到最後收盤價

const axios = require("axios");

async function getStockQuote(stockId) {
  // 1. 產生 timestamp 防止快取
  const t = new Date().getTime();
  
  // 2. 優先嘗試「上市 (tse)」
  // api 格式: tse_{代號}.tw
  let url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_${stockId}.tw&json=1&delay=0&_=${t}`;
  
  try {
    let res = await axios.get(url);
    let data = res.data;

    // 3. 如果上市沒資料，改查「上櫃 (otc)」
    // api 格式: otc_{代號}.tw
    if (!data.msgArray || data.msgArray.length === 0) {
      url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=otc_${stockId}.tw&json=1&delay=0&_=${t}`;
      res = await axios.get(url);
      data = res.data;
    }

    // 4. 真的都沒資料，拋出錯誤
    if (!data.msgArray || data.msgArray.length === 0) {
      // 這裡回傳 null，讓主程式知道沒抓到
      return null;
    }

    // 5. 整理資料
    const info = data.msgArray[0];
    
    // 注意：證交所 API 回傳的欄位都是字串，有時是 "-"
    const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));

    return {
      id: info.c,           // 代號
      name: info.n,         // 名稱
      price: safeNum(info.z), // 現價 (當盤成交價)
      yPrice: safeNum(info.y),// 昨收
      high: safeNum(info.h),  // 最高
      low: safeNum(info.l),   // 最低
      open: safeNum(info.o),  // 開盤
      vol: safeNum(info.v),   // 當盤成交量 (張)
      totalVol: safeNum(info.v), // 累積成交量 (通常 API v 欄位在盤中是累積)
      time: info.t          // 時間
    };

  } catch (err) {
    console.error("❌ Stock API Error:", err.message);
    return null;
  }
}

module.exports = { getStockQuote };
