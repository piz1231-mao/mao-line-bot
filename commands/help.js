module.exports = {
  keywords: ["help", "指令", "說明"],
  handler: async (client, event) => {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text:
`📖 毛怪秘書指令表
━━━━━━━━━━━
📌 查ID / 群組ID
📝 待辦：事項
🧪 流檢：結果
📣 客怨：摘要`
    });
  }
};
