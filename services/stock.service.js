// services/stock.service.js
// 超級全能版：支援 上市、上櫃、期貨 + 中文暱稱自動轉換

const axios = require("axios");

async function getStockQuote(stockId) {
  const t = new Date().getTime();

  // 1. 【翻譯蒟蒻】中文暱稱轉換區
  // 讓你不用背代號，打中文也能通
  let targetId = stockId.toUpperCase(); // 強制轉大寫
  
  if (targetId === "台指" || targetId === "台指期" || targetId === "台指近" || targetId === "台指近全") {
    targetId = "TXF1";
  }
  else if (targetId === "大盤" || targetId === "加權指數") {
    targetId = "t00";
  }

  // 2. 定義要搜尋的三個資料庫 (輪流敲門)
  // tse = 上市 & 大盤
  // otc = 上櫃
  // fut = 期貨 (如 TXF1)
  const targets = [
    `tse_${targetId}.tw`, 
    `otc_${targetId}.tw`,
    `fut_${targetId}.tw`
  ];

  // 3. 開始搜尋
  for (const target of targets) {
    // 這裡用了證交所的公開 API
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${target}&json=1&delay=0&_=${t}`;
    
    try {
      const res = await axios.get(url);
      const data = res.data;

      if (data.msgArray && data.msgArray.length > 0) {
        const info = data.msgArray[0];
        const safeNum = (v) => (isNaN(Number(v)) ? 0 : Number(v));
        
        return {
          id: info.c,           // 代號
          name: info.n,         // 名稱
          price: safeNum(info.z), // 現價
          yPrice: safeNum(info.y),// 昨收
          high: safeNum(info.h),  // 最高
          low: safeNum(info.l),   // 最低
          open: safeNum(info.o),  // 開盤
          vol: safeNum(info.v),   // 量
          time: info.t          // 時間
        };
      }
    } catch (e) {
      continue; // 沒找到就換下一個
    }
  }

  return null;
}

module.exports = { getStockQuote };
