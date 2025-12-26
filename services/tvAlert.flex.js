// ======================================================
// 📢 TradingView Alert Flex
// 呈現優化版（只調間距與對齊）
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
  const stopColor  = "#D97706"; // 停損警示色

  return {
    type: "flex",
    altText: "📢 毛怪秘書出明牌",
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [

          // ===== 標題（你指定的 📢，不再動）=====
          {
            type: "text",
            text: "📢 毛怪秘書出明牌",
            size: "xl",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 週期 + 方向（往中間靠）=====
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
                flex: 3
              },
              {
                type: "text",
                text: `${dirIcon} ${direction}`,
                size: "lg",
                weight: "bold",
                color: dirColor,
                flex: 3,
                align: "start"
              }
            ]
          },

          // ===== 毛怪嘴一句 =====
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F6F6F6",
            cornerRadius: "md",
            paddingAll: "sm",
            contents: [
              {
                type: "text",
                text: `💬 ${talk}`,
                wrap: true,
                size: "md",
                color: "#333333"
              }
            ]
          },

          { type: "separator" },

          // ===== 價格區 =====
          buildActionRow("💎 進場價", price, entryColor),
          buildActionRow("🛡 停損", stopLoss, stopColor),

          // ===== 時間（原樣，因為是對的）=====
          {
            type: "text",
            text: "⏱ 19:20",
            size: "xs",
            color: "#999999"
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
        color: "#666666",
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
