// ======================================================
// 📢 TradingView Alert Flex
// 穩定微調版（語意正確＋排版鬆）
// ======================================================

function buildTVFlex({ timeframe, direction, talk, price, stopLoss }) {
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

          // ===== 週期 + 方向 =====
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

          // ===== 毛怪嘴炮（純文字，不擠）=====
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F3F4F6",
            cornerRadius: "lg",
            paddingAll: "md",
            margin: "md",
            contents: [
              {
                type: "text",
                text: talk,          // ⬅️ 沒有 emoji
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

          // ===== 狀態時間（語意正確）=====
          {
            type: "text",
            text: "⏱ 即時",
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
