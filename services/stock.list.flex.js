// ======================================================
// 🛒 Stock List Flex Formatter（購物車定版）
// ------------------------------------------------------
// 規格：
// - 一檔兩行
//   1️⃣ 名稱
//   2️⃣ 價錢 + 漲跌 + 漲跌幅（同一行、同顏色）
// - 上漲紅 / 下跌綠 / 平盤灰
// - 僅用於「查購物車 / 查清單」
// ======================================================

// 漲跌顏色
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#2E7D32"; // 綠
  return "#666666";                // 灰
}

// 漲跌符號
function arrow(n) {
  if (n > 0) return "▲";
  if (n < 0) return "▼";
  return "—";
}

// 數字格式化
function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

// 單一股票列
function buildStockRow(data) {
  const price = data.price;
  const y = data.yPrice;

  const change =
    price !== null && y !== null
      ? price - y
      : null;

  const pct =
    change !== null && y
      ? (change / y) * 100
      : null;

  const color = colorByChange(change || 0);

  const title =
    data.id && data.name
      ? `${data.id}  ${data.name}`
      : data.name || data.id;

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      // ===== 名稱行 =====
      {
        type: "text",
        text: title,
        weight: "bold",
        size: "sm",
        color: "#222222",
        wrap: true
      },

      // ===== 價錢 + 漲跌（同一行）=====
      {
        type: "text",
        size: "md",        // 🔥 比 sm 大一點點
        wrap: true,
        color,
        text:
          `💰  ${fmt(price, 2)}      ` +
          `${arrow(change)} ${fmt(change, 2)}   (${fmt(pct, 2)}%)`
      }
    ]
  };
}

// 主輸出
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
            weight: "bold",
            size: "lg"
          },
          {
            type: "separator"
          },

          // ===== 清單 =====
          ...list.map(buildStockRow)
        ]
      }
    }
  };
}

module.exports = { buildStockListFlex };
