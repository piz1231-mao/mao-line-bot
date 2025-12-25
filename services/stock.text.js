// ======================================================
// 📊 Stock Text Builder
// ======================================================

function buildStockText(d) {
  if (!d) return "⚠️ 查無此股票，請確認代號是否正確。";

  // ===== 台指期專屬格式 =====
  if (d.type === "future" && d.id === "TXF") {
    const sign = d.change > 0 ? "+" : d.change < 0 ? "-" : "";
    return (
`📊 期貨快報【台指期 TXF】

💰 現價：${d.price}
📈 漲跌：${sign}${Math.abs(d.change)}（${d.percent}%）

📌 開盤：${d.open}
🔺 最高：${d.high}
🔻 最低：${d.low}

📦 總量：${d.vol}
⏰ 時間：${d.time}`
    );
  }

  // ===== 一般股票 / 指數 =====
  const diff = d.price - d.yPrice;
  const pct = d.yPrice ? ((diff / d.yPrice) * 100).toFixed(2) : "0.00";
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";

  return (
`📊 股票快報【${d.name || d.id}】

💰 現價：${d.price}
📈 漲跌：${sign}${Math.abs(diff)}（${pct}%）

📌 開盤：${d.open}
🔺 最高：${d.high}
🔻 最低：${d.low}

📦 成交：${d.vol || "-"}
⏰ 時間：${d.time || ""}`
  );
}

module.exports = { buildStockText };
