module.exports = {
  keywords: ["help", "指令", "說明"],
  handler: async (client, event) => {
    const text =
`📖 毛怪秘書指令表
━━━━━━━━━━━
📌 查ID / 群組ID
📝 待辦：事項
📊 業績：店名 / 金額
🧹 特清：內容
📣 客怨：摘要
🧪 流檢：結果
📝 記事：內容
`;

    await client.replyMessage(event.replyToken, {
      type: "text",
      text
    });
  }
};
