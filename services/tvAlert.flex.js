// ======================================================
// 📢 TradingView Alert Flex
// 穩定版（修正 400 問題）
// ======================================================

function buildTVFlex({ timeframe, direction, talk, price, stopLoss, time }) {
  const isBuy  = direction === "買進";
  const isSell = direction === "賣出";

  const dirColor = isBuy
    ? "#D32F2F"
    : isSell
    ? "#0B8F3A"
    : "#333333";

  const dirIcon = isBuy ? "📈" : isSell ? "📉" : "—";

  const entryColor = dirColor;
  const stopColor  = "#D97706";

  const timeText = time || "即時";

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
            size: "xl",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 週期 + 方向（已拉近）=====
          {
            type: "box",
            layout: "baseline",
            contents: [
              {
                type: "text",
                text: `📊 ${timeframe}`,
                size: "lg",
                weight: "bold",
                color: "#111111",
                flex: 4
              },
              {
                type: "text",
                text: `${dirIcon} ${direction}`,
                size: "lg",
                weight: "bold",
                color: dirColor,
                flex: 3
              }
            ]
          },

          // ===== 毛怪嘴砲（往下拉，用 margin）=====
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F3F4F6",
            cornerRadius: "lg",
            paddingAll: "md",
            margin: "md",          // ✅ 用這個拉距離
            contents: [
              {
                type: "text",
                text: `💬 ${talk}`,
                wrap: true,
                size: "md",
                color: "#374151"
              }
            ]
          },

          { type: "separator" },

          // ===== 價格 =====
          buildActionRow("💎 進場價", price, entryColor),
          buildActionRow("🛡 停損", stopLoss, stopColor),

          // ===== 時間 =====
          {
            type: "text",
            text: `⏱ ${timeText}`,
            size: "xs",
            color: "#9CA3AF"
          }
        ]
      }
    }
  };
}

function buildActionRow(label, value, valueColor) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      {
        type: "text",
        text: label,
        size: "md",
        color: "#6B7280",
        flex: 2
      },
      {
        type: "text",
        text: String(value ?? "—"),
        size: "lg",
        weight: "bold",
        color: valueColor,
        flex: 4
      }
    ]
  };
}

module.exports = { buildTVFlex };
