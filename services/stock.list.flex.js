// ======================================================
// 🛒 Stock List Flex（購物車定版 v1.2.0）
// ======================================================

// ===== 色碼 =====
function colorByChange(change) {
  if (change > 0) return "#D32F2F";   // 紅
  if (change < 0) return "#008A3B";   // 綠（更明顯）
  return "#666666";                   // 灰
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
// 🧩 單一項目 Row
// ======================================================
function buildItemRow(data) {
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
      // ===== 代號 + 名稱 =====
      {
        type: "text",
        text: `${id}  ${name}`,
        size: "md",
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位 / 漲跌 / 漲跌幅（對齊關鍵）=====
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

          // ===== 漲跌（固定欄位，右對齊）=====
          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), id === "TXF" ? 0 : 2)}`,
            size: "md",
            weight: "bold",
            color,
            flex: 2,
            align: "end"
          },

          // ===== 漲跌幅（固定欄位，右對齊）=====
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "md",
            weight: "bold",
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
  if (!list || !list.length) {
    return {
      type: "text",
      text: "📋 我的購物車\n━━━━━━━━━━━\n（清單是空的）"
    };
  }

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

          ...list.map(buildItemRow)
        ]
      }
    }
  };
}

// ======================================================
module.exports = {
  buildStockListFlex
};
