// ======================================================
// 🛒 Stock Flex Formatter（最終定版・封存）
// ------------------------------------------------------
// 使用情境：
// - 查購物車 / 查清單
// - 查單一股票（個股 / 指數 / 台指期）
//
// 設計原則：
// - 價位＋漲跌＋漲跌幅：同一行、同顏色
// - 不使用 baseline（避免 LINE 400）
// - 上漲紅 / 下跌綠 / 平盤灰
// - 視覺接近券商 App
// ======================================================

// ------------------------------------------------------
// 顏色策略（偏券商風格）
// ------------------------------------------------------
function colorByChange(change) {
  if (change > 0) return "#C62828"; // 深紅（比之前更像券商）
  if (change < 0) return "#1B5E20"; // 深綠
  return "#666666";                // 灰
}

// ------------------------------------------------------
// 箭頭符號
// ------------------------------------------------------
function arrow(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "";
}

// ------------------------------------------------------
// 數字格式
// ------------------------------------------------------
function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

// ------------------------------------------------------
// 單一商品（股票 / 指數 / 台指期）
// ------------------------------------------------------
function buildRow(data) {
  const price = data.price;
  const y = data.yPrice;

  const change =
    price !== null && y !== null
      ? price - y
      : 0;

  const pct =
    y
      ? (change / y) * 100
      : 0;

  const color = colorByChange(change);

  const title =
    data.id && data.name
      ? `${data.id}  ${data.name}`
      : data.name || data.id || "—";

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // ===== 名稱 =====
      {
        type: "text",
        text: title,
        size: "md",
        weight: "bold",
        color: "#222222",
        wrap: true
      },

      // ===== 價位＋漲跌（同一行）=====
      {
        type: "text",
        text:
          `💎 ${fmt(price, 2)}   ` +
          `${arrow(change)} ${fmt(change, 2)} (${fmt(pct, 2)}%)`,
        size: "xl",
        weight: "bold",
        color: color,
        wrap: true
      }
    ]
  };
}

// ------------------------------------------------------
// Flex 主體
// ------------------------------------------------------
function buildStockListFlex(list, title = "🛒 我的購物車") {
  return {
    type: "flex",
    altText: title,
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
            text: title,
            size: "lg",
            weight: "bold"
          },
          {
            type: "separator"
          },

          // ===== 清單 =====
          ...list.map(buildRow)
        ]
      }
    }
  };
}

module.exports = { buildStockListFlex };
