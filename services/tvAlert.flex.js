// ======================================================
// 📢 TradingView Alert Flex
// 呈現優化版（字體放大＋方向上色）
// ======================================================

function buildTVFlex({ timeframe, direction, talk, price, stopLoss }) {
  const isBuy  = direction === "買進";
  const isSell = direction === "賣出";

  const dirColor = isBuy
    ? "#D32F2F"   // 紅
    : isSell
    ? "#0B8F3A"   // 綠
    : "#333333";

  const dirIcon = isBuy ? "📈" : isSell ? "📉" : "—";

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

          // =========================
          // 標題
          // =========================
          {
            type: "text",
            text: "📣 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },

          { type: "separator" },

          // =========================
          // 狀態列（週期 + 方向）➡ 放大＋上色
          // =========================
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
                align: "end",
                flex: 3
              }
            ]
          },

          // =========================
          // 毛怪嘴一句（核心）
          // =========================
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F6F6F6",
            cornerRadius: "md",
            paddingAll: "md",
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

          // =========================
          // 行動區（進場 / 停損）➡ 字體放大
          // =========================
          buildActionRow("💎 進場價", price, dirColor),
          buildActionRow("🛡 停損", stopLoss, "#111111"),

          // =========================
          // 時間（輕提示）
          // =========================
          {
            type: "text",
            text: "⏱ 即時訊號",
            size: "xs",
            color: "#999999"
          }
        ]
      }
    }
  };
}

// ======================================================
// 行動列（進場 / 停損）
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
        size: "lg",          // 🔥 比原本大
        weight: "bold",
        color: valueColor,
        flex: 4
      }
    ]
  };
}

module.exports = { buildTVFlex };
