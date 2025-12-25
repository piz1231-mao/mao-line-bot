// services/stock.text.js

function buildStockText(data) {
  if (!data) return "⚠️ 查無此股票，請確認代號是否正確。";

  // 計算漲跌 (防止除以 0 錯誤)
  const diff = data.price - data.yPrice;
  let diffPct = 0;
  if (data.yPrice > 0) {
    diffPct = ((diff / data.yPrice) * 100).toFixed(2);
  }

  // 設定 Emoji 與正負號
  let emoji = "➖"; // 平盤
  let sign = "";
  
  if (diff > 0) {
    emoji = "🔴"; // 漲
    sign = "+";
  } else if (diff < 0) {
    emoji = "🟢"; // 跌
    sign = ""; // 負數自帶負號
  }

  return `📊 股票快報【${data.id} ${data.name}】
━━━━━━━━━━━
💰 現價：${data.price}
${emoji} 漲跌：${sign}${diff.toFixed(2)} (${sign}${diffPct}%)
━━━━━━━━━━━
🌅 開盤：${data.open}
🏔️ 最高：${data.high}
🌊 最低：${data.low}
📉 昨收：${data.yPrice}
📦 成交：${data.vol} 張
🕒 時間：${data.time}`;
}

module.exports = { buildStockText };
