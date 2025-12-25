// ======================================================
// 🛒 Stock List Flex Formatter（購物車定版 v1.0）
// ------------------------------------------------------
// 使用時機：
// - 查購物車
// - 查清單
// - 查股票 購物車
//
// 顯示規格（已定版）：
// - 一檔兩行
//   1️⃣ 代號 + 名稱（稍大字、粗體）
//   2️⃣ 💎 價錢 + 漲跌 + 漲跌幅（同一行、同顏色）
//
// 顏色規則：
// - 上漲：紅色（接近券商紅）
// - 下跌：深綠色（更綠）
// - 平盤：灰色
// ======================================================

// ------------------------------------------------------
// 顏色判斷
// ------------------------------------------------------
function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 券商紅
  if (change < 0) return "#1B5E20"; // 深綠（更綠）
  return "#666666";                // 灰
}

// ------------------------------------------------------
// 漲跌符號
// ------------------------------------------------------
function sign(n) {
  if (n > 0) return "▲";
  if (n < 0) return "▼";
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
// 單一股票列
// ------------------------------------------------------
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
      : data.name || data.id || "—";

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
        size: "md",          // 比原本再大一點
        color: "#222222",
        wrap: true
      },

      // ===== 價錢 + 漲跌（同一行、同顏色）=====
      {
        type: "text",
        size: "md",          // 價錢行放大
        weight: "bold",
        wrap: true,
        text:
          `💎 ${fmt(price, 2)}   ` +
          `${sign(change)} ${fmt(change, 2)}  (${fmt(pct, 2)}%)`,
        color
      }
    ]
  };
}

// ------------------------------------------------------
// 主輸出
// ------------------------------------------------------
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
        spacing: "lg",
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
