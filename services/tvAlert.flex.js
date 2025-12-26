// ======================================================
// 📢 TradingView Alert Flex（版型微調版 v1.0.1）
// ======================================================

function buildTVFlex({ product, direction, timeframe, price, stopLoss }) {
  const dirColor =
    direction === "買進" ? "#D32F2F" :
    direction === "賣出" ? "#0B8F3A" :
    "#222222";

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

          // ===== 標題 =====
          {
            type: "text",
            text: "📢 毛怪秘書出明牌",
            size: "lg",
            weight: "bold",
            color: "#111111"
          },
          { type: "separator" },

          // ===== 週期（重要）=====
          {
            type: "text",
            text: `📊 週期　${timeframe}`,
            size: "md",
            weight: "bold",
            color: "#222222"
          },

          // ===== 方向（重要）=====
          {
            type: "text",
            text: `📈 方向　${direction}`,
            size: "md",
            weight: "bold",
            color: dirColor
          },

          // ===== 毛怪一句話（先留空，之後再接）=====
          {
            type: "text",
            text: "💬 毛怪：條件過了，剩下看你敢不敢。",
            size: "md",
            color: "#333333",
            wrap: true
          },

          { type: "separator" },

          // ===== 價格資訊 =====
          buildKV("💎 進場價", price),
          buildKV("🛡 停損", stopLoss),
          buildKV(
            "⏱ 時間",
            new Date().toLocaleTimeString("zh-TW", {
              hour: "2-digit",
              minute: "2-digit"
            })
          )
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
