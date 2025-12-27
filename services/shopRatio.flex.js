// ======================================================
// 單店銷售佔比 Bubble（C2-1）
// ======================================================
function buildShopRatioBubble({ shop, date, items }) {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `🍱 ${shop}｜銷售佔比`,
          weight: "bold",
          size: "lg"
        },
        {
          type: "text",
          text: date,
          size: "md",
          color: "#888888"
        },
        {
          type: "separator",
          margin: "md"
        },
        ...items.map(item => ({
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: item.name,
              flex: 5,
              size: "md",
              wrap: true
            },
            {
              type: "text",
              text: `${item.qty} 套`,
              flex: 2,
              size: "md",
              align: "end",
              weight: "bold"
            },
            {
              type: "text",
              text: `${item.ratio}%`,
              flex: 2,
              size: "md",
              align: "end",
              color: "#555555"
            }
          ]
        }))
      ]
    }
  };
}
