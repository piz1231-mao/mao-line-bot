// ======================================================
// 📢 TradingView Flex｜毛怪秘書出明牌（定版）
// ======================================================

function buildTVFlex(data) {
  const {
    symbol,
    side,
    timeframe,
    condition,
    entry,
    stop
  } = data;

  return {
    type: "flex",
    altText: "📢 毛怪秘書出明牌",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          // ===== 標題名牌 =====
          {
            type: "text",
            text: "📢 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },
          {
            type: "text",
            text: "━━━━━━━━━━━",
            size: "sm",
            color: "#888888"
          },

          // ===== 內容（完全照原本 emoji）=====
          buildRow("📦 商品", symbol),
          buildRow("📈 方向", side),
          buildRow("🕒 週期", timeframe),
          buildRow("📊 條件", condition),
          buildRow("💰 進場價", entry),
          buildRow("🛡️ 停損價", stop)
        ]
      }
    }
  };
}

// ------------------------------------------------------
// Key / Value Row（保守寫法，避免 400）
// ------------------------------------------------------
function buildRow(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: `${label}：`,
        size: "md",
        color: "#555555",
        flex: 3
      },
      {
        type: "text",
        text: String(value ?? "—"),
        size: "md",
        weight: "bold",
        color: "#111111",
        flex: 5,
        wrap: true
      }
    ]
  };
}

module.exports = {
  buildTVFlex
};
