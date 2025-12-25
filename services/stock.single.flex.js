// ======================================================
// 📊 Stock / Futures Single Flex Formatter（安全定版）
// ------------------------------------------------------
// - 適用：個股 / 指數 / 台指期
// - 價位＋漲跌＋漲跌幅：同一行（baseline）
// - 避免單一 text 過寬造成 LINE 400
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F";   // 紅（券商紅）
  if (change < 0) return "#00A65A";   // 綠（更深）
  return "#666666";
}

function sign(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "";
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

function buildPriceRow(price, change, pct, color) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      {
        type: "text",
        text: "💎",
        size: "lg",
        flex: 0
      },
      {
        type: "text",
        text: fmt(price),
        size: "xl",
        weight: "bold",
        color,
        flex: 3
      },
      {
        type: "text",
        text: `${sign(change)} ${fmt(change)}`,
        size: "md",
        weight: "bold",
        color,
        flex: 3
      },
      {
        type: "text",
        text: `(${fmt(pct)}%)`,
        size: "md",
        color,
        flex: 3
      }
    ]
  };
}

function buildStockSingleFlex(data) {
  const price = data.price;
  const y = data.yPrice;

  const change =
    price !== null && y !== null ? price - y : 0;

  const pct =
    y ? (change / y) * 100 : 0;

  const color = colorByChange(change);

  return {
    type: "flex",
    altText: `${data.id || ""} ${data.name || ""}`.trim(),
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
            text: `${data.id || ""}  ${data.name || ""}`.trim(),
            size: "lg",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 價位主列（安全 baseline）=====
          buildPriceRow(price, change, pct, color),

          { type: "separator" },

          // ===== 明細 =====
          buildInfoRow("🌅 開盤", data.open),
          buildInfoRow("🏔️ 最高", data.high),
          buildInfoRow("🌊 最低", data.low),
          buildInfoRow("📉 昨收", data.yPrice),
          buildInfoRow("📦 成交", data.vol ? `${data.vol} 張` : null),
          buildInfoRow("🕒 時間", data.time)
        ].filter(Boolean)
      }
    }
  };
}

function buildInfoRow(label, value) {
  if (value === null || value === undefined) return null;

  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size: "md",
        color: "#888888",
        flex: 2
      },
      {
        type: "text",
        text: String(value),
        size: "md",
        color: "#222222",
        flex: 4
      }
    ]
  };
}

module.exports = { buildStockSingleFlex };
