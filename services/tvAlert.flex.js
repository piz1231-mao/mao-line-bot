// ======================================================
// 📢 TradingView Alert Flex（定版）
// ======================================================

function buildTVFlex({ timeframe, direction, talk, price, stopLoss, timeText }) {
  const isBuy  = direction === "買進";
  const isSell = direction === "賣出";

  const dirColor = isBuy
    ? "#D32F2F"   // 紅
    : isSell
    ? "#0B8F3A"   // 綠
    : "#333333";

  const dirIcon = isBuy ? "📈" : isSell ? "📉" : "—";

  const entryColor = dirColor;
  const stopColor = "#D97706"; // 停損提醒色

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

          // ===== 週期＋方向 =====
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
                flex: 2
              }
            ]
          },

          // ===== 毛怪嘴炮 =====
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F6F6F6",
            cornerRadius: "md",
            paddingAll: "md",
            contents: [
              {
                type: "text",
                text: talk,
                wrap: true,
                size: "md",
                color: "#333333"
              }
            ]
          },

          { type: "separator" },

          // ===== 價格 =====
          buildActionRow("💎 進場價", price, entryColor),
          buildActionRow("🛡 停損", stopLoss, stopColor),

          // ===== 時間（真正即時）=====
          {
            type: "text",
            text: timeText ? `⏱ ${timeText}` : "⏱ 即時訊號",
            size: "xs",
            color: "#999999"
          }
        ]
      }
    }
  };
}

// ======================================================
// 行動列
// ======================================================
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
