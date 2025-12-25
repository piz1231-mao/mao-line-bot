// ======================================================
// 📊 Stock Single Flex Formatter（完整版）
// ------------------------------------------------------
// 適用：
// - 查個股
// - 查指數
// - 查台指期
//
// 目標：
// - 保留原本文字版的「全部資訊」
// - 用 Flex 重新排版，不洗版
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#1B5E20"; // 深綠
  return "#666666";
}

function sign(n) {
  if (n > 0) return "▲";
  if (n < 0) return "▼";
  return "";
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function row(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size: "sm",
        color: "#888888",
        flex: 2
      },
      {
        type: "text",
        text: value,
        size: "sm",
        color: "#222222",
        flex: 4,
        wrap: true
      }
    ]
  };
}

function buildStockSingleFlex(data) {
  const price = data.price;
  const y = data.yPrice;

  const change =
    price !== null && y !== null
      ? price - y
      : null;

  const pct =
    change !== null && y
      ? (change / y) * 100
      : null;

  const color = colorByChange(change || 0);

  const title =
    data.id && data.name
      ? `${data.id}  ${data.name}`
      : data.name || data.id || "—";

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          // ===== 標題 =====
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "lg",
            wrap: true
          },

          { type: "separator" },

          // ===== 現價 =====
          {
            type: "text",
            text: `💎 ${fmt(price, 2)}`,
            size: "xl",
            weight: "bold",
            color
          },

          // ===== 漲跌 =====
          {
            type: "text",
            text: `${sign(change)} ${fmt(change, 2)}  (${fmt(pct, 2)}%)`,
            size: "md",
            weight: "bold",
            color
          },

          { type: "separator" },

          // ===== 其他資訊 =====
          row("🌅 開盤", fmt(data.open, 2)),
          row("🏔️ 最高", fmt(data.high, 2)),
          row("🌊 最低", fmt(data.low, 2)),
          row("📉 昨收", fmt(data.yPrice, 2)),
          row(
            "📦 成交",
            data.vol !== null ? `${data.vol} 張` : "—"
          ),
          row("🕒 時間", data.time || "—")
        ]
      }
    }
  };
}

module.exports = { buildStockSingleFlex };
