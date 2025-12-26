// ======================================================
// 📢 TradingView Alert Flex
// 呈現定版（只修間距＋嘴砲框）
// ======================================================

function buildTVFlex({ timeframe, direction, talk, price, stopLoss, time }) {
  const isBuy  = direction === "買進";
  const isSell = direction === "賣出";

  const dirColor = isBuy
    ? "#D32F2F"   // 多：紅
    : isSell
    ? "#0B8F3A"   // 空：綠
    : "#333333";

  const dirIcon = isBuy ? "📈" : isSell ? "📉" : "—";

  const entryColor = dirColor;
  const stopColor  = "#D97706"; // 停損警示色（琥珀橘）

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

          // ===== 週期 + 方向（靠中一點）=====
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
                flex: 3   // ← 原本 2，拉近中間
              }
            ]
          },

          // ===== Spacer：讓嘴砲沉下來 =====
          {
            type: "box",
            layout: "vertical",
            contents: [],
            margin: "md"
          },

          // ===== 毛怪嘴砲框（微調後）=====
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F3F4F6",   // 比原本再淡一點
            cornerRadius: "lg",
            paddingTop: "sm",
            paddingBottom: "sm",
            paddingStart: "md",
            paddingEnd: "md",
            contents: [
              {
                type: "text",
                text: `💬 ${talk}`,
                wrap: true,
                size: "md",
                color: "#374151",          // 深灰，不搶紅綠
                lineSpacing: "md"
              }
            ]
          },

          { type: "separator" },

          // ===== 價格區 =====
          buildActionRow("💎 進場價", price, entryColor),
          buildActionRow("🛡 停損", stopLoss, stopColor),

          // ===== 時間 =====
          {
            type: "text",
            text: `⏱ ${time}`,
            size: "xs",
            color: "#9CA3AF"
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
