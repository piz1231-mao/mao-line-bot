// ======================================================
// 📋 Stock List Flex Formatter（購物車定版）
// ------------------------------------------------------
// 規格：
// - 一檔兩行（名稱 / 價格＋漲跌）
// - 價格與漲跌同一行
// - 上漲紅 / 下跌綠 / 平盤灰
// - 適用：個股 / 指數 / 台指期
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#2E7D32"; // 綠
  return "#666666";                // 灰
}

function sign(n) {
  if (n > 0) return "▲";
  if (n < 0) return "▼";
  return "";
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
        color: "#222222"
      },

      // ===== 價格＋漲跌（同一行）=====
      {
        type: "text",
        size: "sm",
        wrap: true,
        text:
          `💰 ${fmt(price, 2)}   ` +
          `${sign(change)} ${fmt(change, 2)}  (${fmt(pct, 2)}%)`,
        color
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
