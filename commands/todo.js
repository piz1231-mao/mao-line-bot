module.exports = {
  keywords: ["待辦"],
  handler: async (client, event) => {
    const task = event.message.text.split(/[:：]/)[1]?.trim();

    if (!task) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 格式：待辦：事項內容"
      });
      return;
    }

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: `📌 已新增待辦：${task}`
    });
  }
};
