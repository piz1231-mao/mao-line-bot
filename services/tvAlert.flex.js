// ======================================================
// 📢 毛怪秘書出明牌｜TradingView Flex
// ======================================================
// 說明：
// - 只負責「長相」
// - 不做任何邏輯、不抓資料
// - 資料全部由 tvAlert.js 傳進來
// ======================================================

function buildTVFlex({
  product = "台指期",
  direction = "—",
  timeframe = "—",
  condition = "分數通過",
  entryPrice = "—",
  stopLoss = "—"
}) {
  return {
    type: "flex",
    altText: `📢 毛怪秘書出明牌｜${product}`,
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
            text: "📢 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },

          {
            type: "text",
            text: "TradingView 訊號",
            size: "sm",
            color: "#666666"
          },

          { type: "separator" },

          // ===== 內容 =====
          buildRow("📦 商品", product),
          buildRow("📈 方向", direction),
          buildRow("🕒 週期", timeframe),
          buildRow("📊 條件", condition),

          { type: "separator" },

          buildRow("💰 進場價", entryPrice),
          buildRow("🛡️ 停損價", stopLoss)
        ]
      }
    }
  };
}

// ------------------------------------------------------
// Key / Value Row（TV 專用）
// ------------------------------------------------------
function buildRow(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size: "md",
        color: "#888888",
        flex: 3
      },
      {
        type: "text",
        text: String(value),
        size: "md",
        weight: "bold",
        color: "#222222",
        flex: 5
      }
    ]
  };
}

module.exports = {
  buildTVFlex
};
