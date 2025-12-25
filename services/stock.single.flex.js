// ======================================================
// 📊 Stock / TXF Single Flex（定版 v1.0）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F";
  if (change < 0) return "#0B8F3A";
  return "#666666";
}

function sign(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "—";
}

function fmt(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(d);
}

// ------------------ 價位主行 ------------------
function buildPriceRow(data, isTXF = false) {
  const { price, change, percent } = data;
  const color = colorByChange(change);

  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: "💎", size: "sm" },
      {
        type: "text",
        text: fmt(price, isTXF ? 0 : 2),
        size: "lg",
        weight: "bold",
        color,
        flex: 2
      },
      { type: "filler" },
      {
        type: "text",
        text: `${sign(change)} ${fmt(Math.abs(change), isTXF ? 0 : 2)}`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      },
      {
        type: "text",
        text: `(${fmt(Math.abs(percent), 2)}%)`,
        size: "md",
        weight: "bold",
        color,
        flex: 2
      }
    ]
  };
}

// ------------------ Key / Value ------------------
function buildKV(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: label, size: "md", color: "#888", flex: 2 },
      { type: "text", text: String(value ?? "—"), size: "md", color: "#222", flex: 4 }
    ]
  };
}

// ------------------ 主入口 ------------------
function buildStockSingleFlex(data) {
  if (!data) return { type: "text", text: "⚠️ 查無資料" };

  const isTXF = data.id === "TXF";

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
            text: `📊 ${isTXF ? "期貨快報" : "股票快報"}【${data.id} ${data.name}】`,
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          buildPriceRow(data, isTXF),

          { type: "separator" },

          buildKV("📌 開盤", fmt(data.open, isTXF ? 0 : 2)),
          buildKV("🔺 最高", fmt(data.high, isTXF ? 0 : 2)),
          buildKV("🔻 最低", fmt(data.low, isTXF ? 0 : 2)),
          !isTXF && buildKV("📉 昨收", fmt(data.yPrice)),
          buildKV("📦 成交", data.vol),
          buildKV("⏰ 時間", data.time)
        ].filter(Boolean)
      }
    }
  };
}

module.exports = { buildStockSingleFlex };
