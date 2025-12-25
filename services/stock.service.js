// services/stock.service.js
const axios = require("axios");

const FINMIND_API = "https://api.finmindtrade.com/api/v4/data";
const TOKEN = process.env.FINMIND_API_TOKEN;

// ===============================
// 判斷是否為台股交易時間（簡化）
// ===============================
function isMarketOpen() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;

  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;

  // 台股 09:00–13:30
  return minutes >= 540 && minutes <= 810;
}

// ===============================
// 取得今日日期（YYYY-MM-DD）
// ===============================
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

// ===============================
// 抓單一股票報價（Phase 1）
// ===============================
async function getStockQuote(stockId) {
  const intraday = isMarketOpen();
  const dataset = intraday
    ? "TaiwanStockPriceMinute"
    : "TaiwanStockPrice";

  const params = {
    dataset,
    data_id: stockId,
    start_date: getToday(),   // ✅ 關鍵修正：盤中也要
    token: TOKEN
  };

  try {
    const res = await axios.get(FINMIND_API, { params });
    const rows = res.data?.data;

    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }

    const last = rows[rows.length - 1];

    return {
      stockId,
      mode: intraday ? "盤中" : "收盤",
      price: Number(last.close),
      open: Number(last.open),
      high: Number(last.max),
      low: Number(last.min),
      volume: Number(last.Trading_Volume),
      time: intraday
        ? `${last.date} ${last.minute}`
        : last.date
    };
  } catch (err) {
    console.error("❌ FinMind Stock API Error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { getStockQuote };
