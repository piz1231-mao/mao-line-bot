// ======================================================
// 🛒 Stock List Flex Formatter（購物車定版｜對齊穩定）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#008A3B"; // 深綠
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
// 🔹 單一商品列
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
      // ===== 代號＋名稱（回到上一版大小）=====
      {
        type: "text",
        text: `${item.id}  ${item.name}`,
        size: "md",        // ⬅️ 比 lg 小一點
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位＋漲跌（定點對齊）=====
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

          // 💎 與價位間距（很小，只拉一點）
          {
            type: "filler",
            flex: 0.3
          },

          // 價位（回上一版大小）
          {
            type: "text",
            text: fmt(item.price, item.id === "TXF" ? 0 : 2),
            size: "md",      // ⬅️ 價位縮回來
            weight: "bold",
            color,
            flex: 3
          },

          // 🔒 固定對齊關鍵：撐到同一條基準線
          {
            type: "filler",
            flex: 1
          },

          // 漲跌（放大一點點、左靠）
          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), 2)}`,
            size: "md",      // ⬅️ 比價位醒目
            weight: "bold",
            color,
            flex: 2,
            align: "start"
          },

          // 漲跌 與 漲跌幅「固定留空」
          {
            type: "filler",
            flex: 0.2
          },

          // 漲跌幅
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "sm",
            color,
            flex: 2,
            align: "start"
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
          // ===== 標題（不變）=====
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
