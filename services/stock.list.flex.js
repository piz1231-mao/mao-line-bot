// ======================================================
// 🛒 Stock List Flex Formatter（購物車穩定定版）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F";
  if (change < 0) return "#008A3B";
  return "#666666";
}

function sign(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "—";
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

// ======================================================
// 單一項目
// ======================================================
function buildItem(item) {
  const price = item.price;
  const y = item.yPrice;

  const change =
    price !== null && y !== null ? price - y : 0;

  const pct =
    y ? (change / y) * 100 : 0;

  const color = colorByChange(change);

  const title =
    item.id && item.name
      ? `${item.id}  ${item.name}`
      : item.name || item.id;

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // ===== 代號＋名稱 =====
      {
        type: "text",
        text: title,
        size: "md",
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位行 =====
      {
        type: "box",
        layout: "baseline",
        contents: [
          // 💎（不動）
          {
            type: "text",
            text: "💎",
            size: "sm",
            flex: 0
          },

          // 💎 與價位的小間距（不動）
          {
            type: "text",
            text: " ",
            size: "xs",
            flex: 0
          },

          // 價位（不動）
          {
            type: "text",
            text: fmt(price, item.id === "TXF" ? 0 : 2),
            size: "md",
            weight: "bold",
            color,
            flex: 3
          },

          // 🔹 關鍵：固定空白 spacer（拉大中間距）
          {
            type: "text",
            text: "     ", // ← 五個空白，穩定、不會炸
            size: "md",
            flex: 0
          },

          // ===== 漲跌（往前、字體加粗）=====
          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), item.id === "TXF" ? 0 : 2)}`,
            size: "md",          // ← 跟價位同級
            weight: "bold",
            color,
            flex: 0
          },

          // 🔹 漲跌與幅度之間固定間距
          {
            type: "text",
            text: "   ",
            size: "sm",
            flex: 0
          },

          // ===== 漲跌幅（位置不動）=====
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "md",
            color,
            flex: 0
          }
        ]
      }
    ]
  };
}

// ======================================================
// 🛒 購物車 Flex
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
          ...list.map(buildItem)
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
