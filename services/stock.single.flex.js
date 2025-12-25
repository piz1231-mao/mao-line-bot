// ======================================================
// 📊 Stock / Futures Single Flex Formatter（定版）
// ------------------------------------------------------
// - 個股：完整資訊卡
// - 台指期（TXF）：專屬期貨格式
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

function row(label, value, size = "md") {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size,
        color: "#888888",
        flex: 2
      },
      {
        type: "text",
        text: value,
        size,
        color: "#222222",
        flex: 4,
        wrap: true
      }
    ]
  };
}

// ======================================================
// 🟦 台指期專屬卡
// ======================================================
function buildTXFFlex(data) {
  const price = data.price;
  const y = data.yPrice;

  const change = price !== null && y !== null ? price - y : null;
  const pct = change !== null && y ? (change / y) * 100 : null;
  const color = colorByChange(change || 0);

  return {
    type: "flex",
    altText: "📊 台指期 TXF",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "📊 期貨快報【台指期 TXF】",
            weight: "bold",
            size: "lg"
          },

          { type: "separator" },

          {
            type: "text",
            text: `💎 ${fmt(price, 0)}`,
            size: "xl",
            weight: "bold",
            color
          },
          {
            type: "text",
            text: `${sign(change)} ${fmt(change, 0)}（${fmt(pct, 2)}%）`,
            size: "lg",
            weight: "bold",
            color
          },

          { type: "separator" },

          row("📌 開盤", fmt(data.open, 0), "md"),
          row("🔺 最高", fmt(data.high, 0), "md"),
          row("🔻 最低", fmt(data.low, 0), "md"),

          { type: "separator" },

          row("📦 總量", data.vol !== null ? `${data.vol}` : "—", "md"),
          row("⏰ 時間", data.time || "—", "md")
        ]
      }
    }
  };
}

// ======================================================
// 🟥 個股完整卡（原本邏輯，僅微調字體）
// ======================================================
function buildStockFlex(data) {
  const price = data.price;
  const y = data.yPrice;

  const change = price !== null && y !== null ? price - y : null;
  const pct = change !== null && y ? (change / y) * 100 : null;
  const color = colorByChange(change || 0);

  const title = `${data.id}  ${data.name}`;

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
          {
            type: "text",
            text: title,
            weight: "bold",
            size: "lg"
          },

          { type: "separator" },

          {
            type: "text",
            text: `💎 ${fmt(price, 2)}`,
            size: "xl",
            weight: "bold",
            color
          },
          {
            type: "text",
            text: `${sign(change)} ${fmt(change, 2)}（${fmt(pct, 2)}%）`,
            size: "lg",
            weight: "bold",
            color
          },

          { type: "separator" },

          row("🌅 開盤", fmt(data.open, 2), "md"),
          row("🏔️ 最高", fmt(data.high, 2), "md"),
          row("🌊 最低", fmt(data.low, 2), "md"),
          row("📉 昨收", fmt(data.yPrice, 2), "md"),
          row("📦 成交", data.vol !== null ? `${data.vol} 張` : "—", "md"),
          row("🕒 時間", data.time || "—", "md")
        ]
      }
    }
  };
}

// ======================================================
// 🔥 單一出口
// ======================================================
function buildStockSingleFlex(data) {
  if (!data) return null;

  // 台指期
  if (data.id === "TXF" || data.name === "台指期") {
    return buildTXFFlex(data);
  }

  // 其餘視為股票
  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
