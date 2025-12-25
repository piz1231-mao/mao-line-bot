// ======================================================
// 🛒 Stock List Flex Formatter（購物車定版）
// ------------------------------------------------------
// 顯示：
// - 代號 + 名稱
// - 💎 價位（與鑽石有極小間距）
// - 漲跌 / 漲跌幅（固定定位，不再調）
// ======================================================

// ===== 色碼（券商風）=====
function colorByChange(change) {
  if (change > 0) return "#D32F2F";   // 紅
  if (change < 0) return "#008A3B";   // 明顯綠
  return "#666666";                  // 平盤灰
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
// 單一項目（一檔股票）
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
      // ===== 代號 + 名稱 =====
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
          // 💎
          {
            type: "text",
            text: "💎",
            size: "sm",
            flex: 0
          },

          // 🔹 極小間距（半個字感）
          {
            type: "text",
            text: " ",
            size: "xs",
            flex: 0
          },

          // 價位
          {
            type: "text",
            text: fmt(price, item.id === "TXF" ? 0 : 2),
            size: "md",
            weight: "bold",
            color,
            flex: 3
          },

          // 固定定位間距（不要再動）
          {
            type: "filler",
            flex: 1
          },

          // 漲跌
          {
            type: "text",
            text: `${sign(change)} ${fmt(Math.abs(change), item.id === "TXF" ? 0 : 2)}`,
            size: "md",
            weight: "bold",
            color,
            flex: 2,
            align: "start"
          },

          // 漲跌幅（與漲跌有固定間距）
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
          // ===== 標題 =====
          {
            type: "text",
            text: "🛒 我的購物車",
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          // ===== 清單 =====
          ...list.map(buildItem)
        ]
      }
    }
  };
}

module.exports = {
  buildStockListFlex
};
