// ======================================================
// 🛒 Stock List Flex Formatter（購物車｜字體放大定版）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#008A3B"; // 深綠（更明顯）
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
// 單筆 Row
// ======================================================
function buildRow(data) {
  const { id, name, price, yPrice } = data;

  const change =
    price !== null && yPrice !== null ? price - yPrice : 0;
  const pct =
    yPrice ? (change / yPrice) * 100 : 0;

  const color = colorByChange(change);

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // ===== 代號＋名稱（放大一點點）=====
      {
        type: "text",
        text: `${id}  ${name}`,
        size: "lg",              // ⬅ 原 md → lg
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位主行 =====
      {
        type: "box",
        layout: "baseline",
        contents: [
          {
            type: "text",
            text: "💎",
            size: "md",           // ⬅ 原 sm → md
            flex: 0
          },

          // 跟鑽石拉一點距離（安全作法）
          {
            type: "text",
            text: "  ",
            size: "md",
            flex: 0
          },

          {
            type: "text",
            text: fmt(price, id === "TXF" ? 0 : 2),
            size: "lg",           // ⬅ 原 md → lg
            weight: "bold",
            color,
            flex: 3
          },

          {
            type: "filler"
          },

          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), id === "TXF" ? 0 : 2)}`,
            size: "md",           // ⬅ 原 sm → md
            weight: "bold",
            color,
            flex: 2,
            align: "end"
          },
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "md",           // ⬅ 原 sm → md
            color,
            flex: 2,
            align: "end"
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
            size: "xl",          // ⬅ 原 lg → xl
            weight: "bold"
          },
          { type: "separator" },

          ...list.map(buildRow)
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
