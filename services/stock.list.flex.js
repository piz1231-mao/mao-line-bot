// ======================================================
// 🛒 Stock List Flex Formatter（穩定對齊最終版）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#008A3B"; // 綠
  return "#666666";                // 平盤
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

// ======================================================
// 🔹 單一項目
// ======================================================
function buildRow(item) {
  const change = item.price - item.yPrice;
  const pct = item.yPrice ? (change / item.yPrice) * 100 : 0;
  const color = colorByChange(change);

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // 代號＋名稱
      {
        type: "text",
        text: `${item.id}  ${item.name}`,
        size: "md",
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // 價位列（固定欄位對齊）
      {
        type: "box",
        layout: "baseline",
        contents: [
          // 💎
          {
            type: "text",
            text: "💎",
            size: "sm",
            flex: 0
          },

          // 價位
          {
            type: "text",
            text: fmt(item.price, item.id === "TXF" ? 0 : 2),
            size: "md",
            weight: "bold",
            color,
            flex: 3
          },

          // 漲跌
          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), 2)}`,
            size: "md",
            weight: "bold",
            color,
            flex: 2
          },

          // ✅ 漲跌幅（字體調整，其他不變）
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "md",        // ← 原本 sm
            weight: "bold",    // ← 新增
            color,
            flex: 2
          }
        ]
      }
    ]
  };
}

// ======================================================
// 🛒 清單主體
// ======================================================
function buildStockListFlex(list) {
  return {
    type: "flex",
    altText: "🛒 我的購物車",
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
            text: "🛒 我的購物車",
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          ...list.map(buildRow)
        ]
      }
    }
  };
}

module.exports = { buildStockListFlex };
