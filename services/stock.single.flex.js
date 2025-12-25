// ======================================================
// 📊 Stock Single Flex Formatter（單一股票 / 指數 / 期貨）
// ------------------------------------------------------
// 使用時機：
// - 股 2330
// - 查股票 3105
// - 台指期 / 櫃買 / 大盤
//
// 顯示定位：
// - 一檔一個 Bubble
// - 資訊完整但不雜
// - 專業券商風格
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#1B5E20"; // 深綠
  return "#666666";
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

function buildStockSingleFlex(data) {
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
            weight: "bold",
            size: "lg",
            wrap: true
          },

          {
            type: "separator"
          },

          // ===== 價格 =====
          {
            type: "text",
            text: `💎 ${fmt(price, 2)}`,
            size: "xl",
            weight: "bold",
            color
          },

          // ===== 漲跌 =====
          {
            type: "text",
            text: `${sign(change)} ${fmt(change, 2)}  (${fmt(pct, 2)}%)`,
            size: "md",
            weight: "bold",
            color
          }
        ]
      }
    }
  };
}

module.exports = { buildStockSingleFlex };
