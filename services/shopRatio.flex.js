// ======================================================
// 單店銷售佔比 Flex（C2-1 定版）
// ======================================================
function buildShopRatioFlex({ shop, date, items }) {
  return {
    type: "flex",
    altText: `🍱 ${shop} 銷售佔比`,
    contents: {
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
            size: "sm",
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
                flex: 4,
                size: "sm",
                wrap: true
              },
              {
                type: "text",
                text: `${item.qty} 套`,
                flex: 2,
                size: "sm",
                align: "end"
              },
              {
                type: "text",
                text: `${item.ratio}%`,
                flex: 2,
                size: "sm",
                align: "end",
                color: "#555555"
              }
            ]
          }))
        ]
      }
    }
  };
}

// ⚠️ 關鍵：只能這樣 export
module.exports = buildShopRatioFlex;
