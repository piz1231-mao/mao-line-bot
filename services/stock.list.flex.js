// ======================================================
// 🛒 Stock List Flex（購物車定版 v1.2｜字級微調）
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#0B8F3A"; // 綠
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
// 單一股票區塊（兩行）
// ======================================================
function buildItem(stock) {
  const { id, name, price, yPrice } = stock;

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
      // ===== 第一行：代號＋名稱（字體加大）=====
      {
        type: "text",
        text: `${id}  ${name}`,
        size: "md",          // ← 原本 sm，改成 md
        weight: "bold",
        color: "#111111"
      },

      // ===== 第二行：價格列（不動）=====
      {
        type: "box",
        layout: "baseline",
        contents: [
          {
            type: "text",
            text: "💎",
            size: "sm",
            flex: 0
          },
          {
            type: "text",
            text: fmt(price, id === "TXF" ? 0 : 2),
            size: "md",
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
            size: "sm",
            weight: "bold",
            color,
            flex: 2
          },
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "sm",
            color,
            flex: 2
          }
        ]
      }
    ]
  };
}

// ======================================================
// 主 Flex
// ======================================================
function buildStockListFlex(list = []) {
  if (!list.length) {
    return {
      type: "text",
      text: "📋 我的購物車\n━━━━━━━━━━━\n\n（清單是空的）"
    };
  }

  const items = [];
  list.forEach((s, i) => {
    items.push(buildItem(s));
    if (i !== list.length - 1) {
      items.push({ type: "separator" });
    }
  });

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
          // ===== 標題字體加大 =====
          {
            type: "text",
            text: "🛒 我的購物車",
            size: "xl",        // ← 原本 lg，改成 xl
            weight: "bold"
          },
          { type: "separator" },
          ...items
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
