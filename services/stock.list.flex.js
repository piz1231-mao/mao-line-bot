// ======================================================
// 🛒 Stock List Flex Formatter（購物車定版）
// ------------------------------------------------------
// 規格：
// - 一檔兩行（名稱 / 價格＋漲跌）
// - 價格＋漲跌同一行、同一顏色
// - 上漲紅 / 下跌綠 / 平盤灰
// - 適用：個股 / 指數 / 台指期
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#2E7D32"; // 綠
  return "#666666";                // 灰
}

function arrow(change) {
  if (change > 0) return "▲";
  if (change < 0) return "▼";
  return "－";
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Number(n).toFixed(digits);
}

function buildStockRow(data) {
  const price = data.price;
  const y = data.yPrice;

  const change =
    price !== null && y !== null
      ? price - y
      : 0;

  const pct =
    y ? (change / y) * 100 : 0;

  const color = colorByChange(change);

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
        size: "sm",
        weight: "bold",
        color: "#222222"
      },

      // ===== 價格＋漲跌（同一行、同一顏色）=====
      {
        type: "text",
        size: "sm",
        wrap: true,
        color,
        text:
          `💰 ${fmt(price, 2)}   ` +
          `${arrow(change)} ${fmt(change, 2)}  (${fmt(pct, 2)}%)`
      }
    ]
  };
}

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
