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

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ===============================
// 共用呼叫 FinMind
// ===============================
async function fetchFinMind(dataset, stockId) {
  const res = await axios.get(FINMIND_API, {
    params: {
      dataset,
      data_id: stockId,
      start_date: today(),
      token: TOKEN
    }
  });
  return res.data?.data || [];
}

// ===============================
// 單一股票查詢（Phase 1 穩定版）
// ===============================
async function getStockQuote(stockId) {
  try {
    const intraday = isMarketOpen();

    // ① 盤中先試分鐘線
    if (intraday) {
      const minuteRows = await fetchFinMind(
        "TaiwanStockPriceMinute",
        stockId
      );

      if (minuteRows.length > 0) {
        const last = minuteRows.at(-1);
        return formatResult(stockId, "盤中", last, true);
      }
      // ⚠️ 關鍵：盤中分鐘線可能為空 → 不 return
    }

    // ② fallback 用日線（一定有）
    const dailyRows = await fetchFinMind(
      "TaiwanStockPrice",
      stockId
    );

    if (dailyRows.length > 0) {
      const last = dailyRows.at(-1);
      return formatResult(stockId, "收盤", last, false);
    }

    // ③ 真的查不到
    return null;

  } catch (err) {
    console.error("❌ FinMind Stock Error:", err.response?.data || err.message);
    return null;
  }
}

// ===============================
// 統一格式
// ===============================
function formatResult(stockId, mode, row, isMinute) {
  return {
    stockId,
    mode,
    price: Number(row.close),
    open: Number(row.open),
    high: Number(row.max),
    low: Number(row.min),
    volume: Number(row.Trading_Volume),
    time: isMinute
      ? `${row.date} ${row.minute}`
      : row.date
  };
}

module.exports = { getStockQuote };
