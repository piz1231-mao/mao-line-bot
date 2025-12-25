// services/stock.service.js
// 全自動搜尋版：自動判斷上市(tse)、上櫃(otc)、指數(t00)

const axios = require("axios");

async function getStockQuote(stockId) {
  const t = new Date().getTime();
  
  // 這裡定義我們要「輪流嘗試」的清單
  // tse_xxx.tw = 上市股票、大盤指數 (t00)
  // otc_xxx.tw = 上櫃股票
  const targets = [
    `tse_${stockId}.tw`, 
    `otc_${stockId}.tw`
  ];

  // 使用迴圈，一個一個試
  for (const target of targets) {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${target}&json=1&delay=0&_=${t}`;
    
    try {
      const res = await axios.get(url);
      const data = res.data;

      // 如果 msgArray 裡面有東西，代表找到了！
      if (data.msgArray && data.msgArray.length > 0) {
        const info = data.msgArray[0];
        const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));
        
        return {
          id: info.c,           // 代號
          name: info.n,         // 名稱
          price: safeNum(info.z), // 現價 (當盤成交價)
          yPrice: safeNum(info.y),// 昨收
          high: safeNum(info.h),  // 最高
          low: safeNum(info.l),   // 最低
          open: safeNum(info.o),  // 開盤
          vol: safeNum(info.v),   // 量
          time: info.t          // 時間
        };
      }
    } catch (e) {
      // 找不到就安靜地繼續試下一個，不用報錯
      continue;
    }
  }

  // 如果跑完所有可能性都沒找到
  return null;
}

module.exports = { getStockQuote };
