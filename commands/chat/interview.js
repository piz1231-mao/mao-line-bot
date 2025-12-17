module.exports = {
  keywords: ["面試", "錄取"],
  handler: async (client, event) => {
    const text = event.message.text;
    const content = text.split(/[:：]/)[1]?.trim();

    if (!content) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 格式：面試：姓名 / 職位 / 備註"
      });
      return;
    }

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ 已登記面試紀錄：\n${content}`
    });

    // 👉 之後可接 Google Sheet
  }
};
