// ======================================================
// 📢 TradingView Alert Flex
// v1.1（時間語氣優化版｜不動邏輯）
// ======================================================

function buildTVFlex({
  product,
  direction,
  timeframe,
  price,
  stopLoss,
  timeText
}) {
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
          // ===== 標題 =====
          {
            type: "text",
            text: "📣 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 週期 & 方向 =====
          buildKV("📊 週期", timeframe || "未指定"),
          buildKV("📈 方向", direction || "—"),

          // ===== 毛怪嘴一句（先固定，後面再接分數）=====
          {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "💬 毛怪嘴一句",
                size: "sm",
                color: "#888888"
              },
              {
                type: "text",
                text: "條件過了，剩下看你敢不敢。",
                size: "md",
                wrap: true
              }
            ]
          },

          // ===== 時間（有態度）=====
          buildKV(
            "⏱",
            timeText
              ? `${timeText}　你現在看到算你快`
              : "即時訊號"
          ),

          { type: "separator" },

          // ===== 價格 =====
          buildKV("💎 進場價", price ?? "—"),
          buildKV("🛡 停損", stopLoss ?? "—")
        ]
      }
    }
  };
}

// ======================================================
// 共用 Key / Value
// ======================================================
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
        text: String(value),
        size: "md",
        color: "#222222",
        flex: 4,
        wrap: true
      }
    ]
  };
}

module.exports = { buildTVFlex };
