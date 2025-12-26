// ======================================================
// 📢 TradingView Alert Flex
// 狀態式訊號版（只補時間，不動感覺）
// ======================================================

function buildTVFlex({
  product,
  direction,
  timeframe,
  price,
  stopLoss,
  timeText
}) {
  // ---- 防呆顯示 ----
  const dirText =
    direction === "買進" ? "📈 買進" :
    direction === "賣出" ? "📉 賣出" :
    "—";

  const tfText = timeframe || "未指定";

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
            text: "📢 毛怪秘書出明牌",
            size: "lg",
            weight: "bold"
          },

          { type: "separator" },

          // ===== 狀態列 =====
          {
            type: "text",
            text: `📊 ${tfText}｜${dirText}`,
            size: "md",
            weight: "bold",
            color: "#111111"
          },

          // ===== 毛怪嘴 =====
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F6F6F6",
            cornerRadius: "md",
            paddingAll: "md",
            contents: [
              {
                type: "text",
                text: "💬 毛怪嘴一句：條件過了，剩下看你敢不敢。",
                wrap: true,
                size: "md",
                color: "#333333"
              }
            ]
          },

          { type: "separator" },

          // ===== 行動區 =====
          buildActionRow("💎 進場價", price),
          buildActionRow("🛡 停損", stopLoss),

          // ===== 時間（輕提示）=====
          {
            type: "text",
            text: timeText
              ? `⏱ ${timeText}　你現在看到算你快`
              : "⏱ 即時訊號",
            size: "xs",
            color: "#999999",
            margin: "md"
          }
        ]
      }
    }
  };
}

// ======================================================
// 行動列
// ======================================================
function buildActionRow(label, value) {
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
        color: "#111111",
        flex: 4
      }
    ]
  };
}

module.exports = { buildTVFlex };
