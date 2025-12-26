// ======================================================
// 📢 TradingView Alert Flex（毛怪版 v1.1）
// ======================================================

function buildTVFlex({ timeframe, direction, talk, price, stopLoss }) {
  return {
    type: "flex",
    altText: "📣 毛怪秘書出明牌",
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
            text: "📣 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },
          { type: "separator" },

          buildKV("📊 週期", timeframe),
          buildKV("📈 方向", direction),

          {
            type: "text",
            text: `💬 ${talk}`,
            wrap: true,
            size: "md",
            margin: "md"
          },

          { type: "separator" },

          buildKV("💎 進場價", price),
          buildKV("🛡 停損", stopLoss),

          {
            type: "text",
            text: `⏱ ${new Date().toLocaleTimeString("zh-TW", {
              hour: "2-digit",
              minute: "2-digit"
            })}`,
            size: "sm",
            color: "#888888",
            align: "end",
            margin: "md"
          }
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
