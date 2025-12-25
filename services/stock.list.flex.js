// ======================================================
// 🛒 Stock Cart Flex（最終穩定對齊版）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F";   // 紅
  if (change < 0) return "#008A3B";   // 綠（明顯一點）
  return "#666666";                  // 平盤
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
// 🔹 單筆購物車 Row（重點在這）
// ======================================================
function buildCartRow({ price, yPrice }) {
  const change =
    price !== null && yPrice !== null ? price - yPrice : 0;
  const pct = yPrice ? (change / yPrice) * 100 : 0;
  const color = colorByChange(change);

  return {
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

      // 價位（鎖死，不再動）
      {
        type: "text",
        text: fmt(price),
        size: "md",
        weight: "bold",
        color,
        flex: 3
      },

      // ⭐ 漲跌（固定錨點，往左一點）
      {
        type: "text",
        text: `${sign(change)} ${fmt(Math.abs(change))}`,
        size: "md",
        weight: "bold",
        color,
        flex: 2,          // ← 關鍵：固定欄位
        align: "start"    // ← 左對齊，所有列都一樣
      },

      // ⭐ 固定留白欄位（只負責間距）
      {
        type: "text",
        text: " ",
        size: "md",
        flex: 0.5
      },

      // 漲跌幅（位置鎖死）
      {
        type: "text",
        text: `(${fmt(Math.abs(pct), 2)}%)`,
        size: "md",
        weight: "bold",   // ← 不用細字
        color,
        flex: 2,
        align: "start"
      }
    ]
  };
}

// ======================================================
// 🛒 購物車 Flex 主體
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

          ...list.map(d => ({
            type: "box",
            layout: "vertical",
            spacing: "xs",
            contents: [
              {
                type: "text",
                text: `${d.id}  ${d.name}`,
                size: "md",
                weight: "bold",
                color: "#222222"
              },
              buildCartRow(d)
            ]
          }))
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
