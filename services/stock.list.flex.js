// ======================================================
// 🛒 Stock List Flex Formatter（購物車 v1.2｜券商綠＋加粗）
// ------------------------------------------------------
// v1.0：結構定版
// v1.1：券商配色
// v1.2：
//   - 下跌綠色更明顯
//   - 價錢列字體加粗
// ======================================================

// 券商風漲跌顏色
function colorByChange(change) {
  if (change > 0) return "#C62828"; // 券商紅
  if (change < 0) return "#006400"; // 更綠的券商綠（關鍵調整）
  return "#616161";                // 深灰
}

// 漲跌符號
function arrow(n) {
  if (n > 0) return "▲";
  if (n < 0) return "▼";
  return "—";
}

// 數字格式
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
        color: "#212121",
        wrap: true
      },

      // ===== 價錢＋漲跌（同一行、同色、加粗）=====
      {
        type: "text",
        size: "md",
        weight: "bold",   // ⭐ 加粗關鍵
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
          {
            type: "text",
            text: "🛒 我的購物車",
            weight: "bold",
            size: "lg"
          },
          {
            type: "separator"
          },
          ...list.map(buildStockRow)
        ]
      }
    }
  };
}

module.exports = { buildStockListFlex };
