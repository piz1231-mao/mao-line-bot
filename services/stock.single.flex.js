// ======================================================
// 📊 Stock / Futures Single Flex Formatter（定版）
// - 個股：完整資訊
// - 台指期：專屬期貨格式
// - 價位＋漲跌＋漲跌幅：同一行、同色
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
      { type: "text", text: label, size: "md", color: "#888", flex: 2 },
      { type: "text", text: value, size: "md", color: "#222", flex: 4 }
    ]
  };
}

// ======================================================
// 🟦 台指期 TXF
// ======================================================
function buildTXFFlex(data) {
  const price = data.price;
  const y = data.yPrice;

  const change = price != null && y != null ? price - y : 0;
  const pct = y ? (change / y) * 100 : 0;
  const color = colorByChange(change);

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
            size: "lg",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 價位同一行 =====
          {
            type: "text",
            text: `💎 ${fmt(price, 0)}   ${sign(change)} ${fmt(change, 0)} (${fmt(pct, 2)}%)`,
            size: "xl",
            weight: "bold",
            color
          },

          { type: "separator" },

          row("📌 開盤", fmt(data.open, 0)),
          row("🔺 最高", fmt(data.high, 0)),
          row("🔻 最低", fmt(data.low, 0)),

          { type: "separator" },

          row("📦 總量", data.vol != null ? `${data.vol}` : "—"),
          row("⏰ 時間", data.time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 🟥 個股
// ======================================================
function buildStockFlex(data) {
  const price = data.price;
  const y = data.yPrice;

  const change = price != null && y != null ? price - y : 0;
  const pct = y ? (change / y) * 100 : 0;
  const color = colorByChange(change);

  return {
    type: "flex",
    altText: `${data.id} ${data.name}`,
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
            text: `${data.id}  ${data.name}`,
            size: "lg",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 價位同一行 =====
          {
            type: "text",
            text: `💎 ${fmt(price, 2)}   ${sign(change)} ${fmt(change, 2)} (${fmt(pct, 2)}%)`,
            size: "xl",
            weight: "bold",
            color
          },

          { type: "separator" },

          row("🌅 開盤", fmt(data.open, 2)),
          row("🏔️ 最高", fmt(data.high, 2)),
          row("🌊 最低", fmt(data.low, 2)),
          row("📉 昨收", fmt(data.yPrice, 2)),
          row("📦 成交", data.vol != null ? `${data.vol} 張` : "—"),
          row("🕒 時間", data.time || "—")
        ]
      }
    }
  };
}

// ======================================================
// 🔥 出口
// ======================================================
function buildStockSingleFlex(data) {
  if (!data) return null;
  if (data.id === "TXF" || data.name === "台指期") return buildTXFFlex(data);
  return buildStockFlex(data);
}

module.exports = { buildStockSingleFlex };
