const axios = require("axios");

const FINMIND_API = "https://api.finmindtrade.com/api/v4/data";
const TOKEN = process.env.FINMIND_API_TOKEN;

function isMarketOpen() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;
  return minutes >= 540 && minutes <= 810;
}

async function getStockQuote(stockId) {
  const intraday = isMarketOpen();
  const dataset = intraday
    ? "TaiwanStockPriceMinute"
    : "TaiwanStockPrice";

  const params = {
    dataset,
    data_id: stockId,
    token: TOKEN
  };

  if (!intraday) {
    params.start_date = new Date().toISOString().slice(0, 10);
  }

  try {
    const res = await axios.get(FINMIND_API, { params });
    const rows = res.data.data;
    if (!rows || rows.length === 0) return null;

    const last = rows[rows.length - 1];

    return {
      stockId,
      mode: intraday ? "盤中" : "收盤",
      price: last.close,
      open: last.open,
      high: last.max,
      low: last.min,
      volume: last.Trading_Volume,
      time: intraday ? `${last.date} ${last.minute}` : last.date
    };
  } catch (err) {
    console.error("Stock API error:", err.message);
    return null;
  }
}

module.exports = { getStockQuote };
