// ======================================================
// stock.list.flex.js
// 購物車 Flex Message（定版穩定對齊版）
// ======================================================

function buildStockListFlex(list = []) {
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
          // ===== 標題 =====
          {
            type: "text",
            text: "🛒 我的購物車",
            size: "lg",
            weight: "bold"
          },
          {
            type: "separator"
          },

          // ===== 清單 =====
          ...list.map(buildItem)
        ]
      }
    }
  };
}

// ======================================================
// 單筆項目
// ======================================================
function buildItem(item) {
  const {
    id,
    name,
    price,
    yPrice
  } = item;

  const change =
    price !== null && yPrice !== null ? price - yPrice : 0;

  const pct =
    yPrice ? (change / yPrice) * 100 : 0;

  const isUp = change > 0;
  const isDown = change < 0;

  const color = isUp
    ? "#D32F2F"
    : isDown
    ? "#008A3B"
    : "#666666";

  const arrow = isUp
    ? "▲"
    : isDown
    ? "▼"
    : "—";

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // ===== 代號＋名稱 =====
      {
        type: "text",
        text: `${id}  ${name}`,
        size: "md",
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位列 =====
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

          // 價位（鎖死位置）
          {
            type: "text",
            text: Number(price).toFixed(2),
            size: "md",
            weight: "bold",
            color,
            flex: 3
          },

          // 漲跌（固定錨點）
          {
            type: "text",
            text: `${arrow} ${Math.abs(change).toFixed(2)}`,
            size: "md",
            weight: "bold",
            color,
            flex: 2,
            align: "start"
          },

          // 安全間距（不是空字）
          {
            type: "text",
            text: "\u2009\u2009", // thin space ×2
            size: "md",
            flex: 0.5,
            color: "#FFFFFF"
          },

          // 漲跌幅（位置鎖死）
          {
            type: "text",
            text: `(${Math.abs(pct).toFixed(2)}%)`,
            size: "md",
            weight: "bold",
            color,
            flex: 2,
            align: "start"
          }
        ]
      }
    ]
  };
}

module.exports = {
  buildStockListFlex
};
