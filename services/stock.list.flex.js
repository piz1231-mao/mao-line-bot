// ======================================================
// 🛒 Stock List Flex Formatter（購物車｜定版）
// ------------------------------------------------------
// 顯示：
// - 代號 + 名稱（加大）
// - 💎 價位｜漲跌｜漲跌幅（同一行、對齊）
// ======================================================

// ===== 券商風色碼 =====
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#008A3B"; // 深券商綠
  return "#666666";                // 平盤灰
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
// 單一商品 Row
// ======================================================
function buildRow(data) {
  const {
    id,
    name,
    price,
    yPrice
  } = data;

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
      // ===== 代號＋名稱（加大一點）=====
      {
        type: "text",
        text: `${id}  ${name}`,
        size: "md",          // ✅ 比之前大一點
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位主行（對齊版）=====
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

          // 💎 與價位間距（安全 filler）
          {
            type: "filler",
            flex: 0.3
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
            type: "filler",
            flex: 1
          },

          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), id === "TXF" ? 0 : 2)}`,
            size: "sm",
            weight: "bold",
            color,
            flex: 2,
            align: "end"
          },
          {
            type: "text",
            text: `(${fmt(Math.abs(pct), 2)}%)`,
            size: "sm",
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
          // ===== 標題（加大一點）=====
          {
            type: "text",
            text: "🛒 我的購物車",
            size: "lg",       // ✅ 比剛剛再大一點
            weight: "bold"
          },
          { type: "separator" },

          // ===== 清單 =====
          ...list.map(buildRow)
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
