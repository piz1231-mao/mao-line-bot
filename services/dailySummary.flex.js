// ======================================================
// 每日營運總覽 Flex（C1 定版｜人事門檻分店）
// ======================================================

function getHRThreshold(shopName) {
  if (shopName.includes("茶六")) return 22;
  return 25; // 三山、湯棧
}

function buildShopSummaryBubble(shop) {
  const threshold = getHRThreshold(shop.name);
  const hrOver = shop.hrTotalRate > threshold;

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "text",
          text: `【${shop.name}｜${shop.date}】`,
          weight: "bold",
          size: "md"
        },

        {
          type: "text",
          text: `💰 業績：${shop.revenue.toLocaleString()}`,
          size: "sm"
        },
        {
          type: "text",
          text: `📦 ${shop.qtyLabel}：${shop.qty}`,
          size: "sm"
        },
        {
          type: "text",
          text: `🧾 客單價：${shop.unit}`,
          size: "sm"
        },

        {
          type: "separator",
          margin: "md"
        },

        {
          type: "text",
          text: "👥 人事",
          weight: "bold",
          size: "sm"
        },
        {
          type: "text",
          text: `外場：${shop.fp.toLocaleString()}（${shop.fpRate}%）`,
          size: "sm"
        },
        {
          type: "text",
          text: `內場：${shop.bp.toLocaleString()}（${shop.bpRate}%）`,
          size: "sm"
        },
        {
          type: "text",
          text: `總計：${shop.hrTotal.toLocaleString()}（${shop.hrTotalRate}%）`,
          size: "sm",
          weight: hrOver ? "bold" : "regular",
          color: hrOver ? "#D32F2F" : "#333333"
        }
      ]
    }
  };
}

function buildDailySummaryFlex({ date, shops }) {
  return {
    type: "flex",
    altText: `每日營運總覽｜${date}`,
    contents: {
      type: "carousel",
      contents: shops.map(buildShopSummaryBubble)
    }
  };
}

module.exports = { buildDailySummaryFlex };
