// ======================================================
// 📢 TradingView Alert Flex（定版 v1.0）
// ======================================================

function buildTVFlex({ product, direction, timeframe, price, stopLoss }) {
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
          {
            type: "text",
            text: "📢 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          buildKV("📦 商品", product),
          buildKV("📈 方向", direction),
          buildKV("🕒 週期", timeframe),
          buildKV("📊 條件", "分數通過"),
          buildKV("💰 進場價", price),
          buildKV("🛡️ 停損價", stopLoss)
        ]
      }
    }
  };
}

function buildKV(label, value) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size: "md",
        color: "#888888",
        flex: 2
      },
      {
        type: "text",
        text: String(value ?? "—"),
        size: "md",
        color: "#222222",
        flex: 4
      }
    ]
  };
}

module.exports = { buildTVFlex };
