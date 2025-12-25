// ======================================================
// 📋 Stock List Formatter（購物車專用）
// ------------------------------------------------------
// 規則：
// - 只顯示 現價 / 漲跌 / 漲跌幅
// - 不顯示開高低、成交量、時間
// - 一檔固定 2 行，防止 LINE 爆版
// ======================================================

function formatListItem(item) {
  if (!item || item.price == null || item.yPrice == null) {
    return null;
  }

  const diff = item.price - item.yPrice;
  const pct = item.yPrice !== 0
    ? (diff / item.yPrice * 100)
    : 0;

  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "─";
  const sign = diff > 0 ? "+" : "";

  const title = item.type === "index"
    ? item.name
    : `${item.id}  ${item.name}`;

  return `${title}
💰 ${item.price}  ${arrow}${sign}${diff.toFixed(1)}  (${sign}${pct.toFixed(2)}%)`;
}

function buildStockListText(list) {
  const lines = list
    .map(formatListItem)
    .filter(Boolean);

  if (!lines.length) {
    return "📋 我的購物車\n━━━━━━━━━━━\n\n（目前沒有可顯示的項目）";
  }

  return `📋 我的購物車
━━━━━━━━━━━

${lines.join("\n\n")}`;
}

module.exports = { buildStockListText };
