function buildStockText(data) {
  if (!data) {
    return "⚠️ 查無資料，請確認股票代碼是否正確";
  }

  const { stockId, mode, price, open, high, low, volume, time } = data;
  const diff = (price - open).toFixed(2);
  const pct = ((diff / open) * 100).toFixed(2);
  const arrow = diff >= 0 ? "📈" : "📉";
  const sign = diff >= 0 ? "+" : "";

  return `
📊 股票快看｜${stockId}
━━━━━━━━━━━
🕒 狀態：${mode}
💰 價格：${price}
${arrow} 漲跌：${sign}${diff} (${pct}%)
📦 成交量：${volume}
📉 區間：${low} – ${high}
⏱ 更新：${time}
`.trim();
}

module.exports = { buildStockText };
