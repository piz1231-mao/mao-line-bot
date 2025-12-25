// ======================================================
// 📦 購物車 Flex Formatter（上色版）
// ------------------------------------------------------
// 只用於「查購物車 / 查清單」
// 顯示：名稱 / 現價 / 漲跌 / 漲跌幅
// ======================================================

function colorByChange(change) {
  if (change > 0) return "#D32F2F"; // 紅
  if (change < 0) return "#388E3C"; // 綠
  return "#666666";                // 灰
}

function sign(v) {
  if (v > 0) return "+";
  return "";
}

function formatItem(item) {
  const change = item.price - item.yPrice;
  const percent = item.yPrice
    ? ((change / item.yPrice) * 100).toFixed(2)
    : "0.00";

  const color = colorByChange(change);

  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      {
        type: "text",
        text: `${item.id}  ${item.name}`,
        size: "sm",
        weight: "bold",
        wrap: true
      },
      {
        type: "text",
        text: `💰 ${item.price}`,
        size: "md",
        weight: "bold"
      },
      {
        type: "text",
        text: `${sign(change)}${change.toFixed(2)}  (${sign(percent)}${percent}%)`,
        size: "sm",
        color
      }
    ]
  };
}

function buildStockListFlex(items) {
  return {
    type: "flex",
    altText: "📋 我的購物車",
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📋 我的購物車",
            weight: "bold",
            size: "lg"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: items.map(formatItem)
      }
    }
  };
}

module.exports = { buildStockListFlex };
