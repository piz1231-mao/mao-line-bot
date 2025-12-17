module.exports = {
  keywords: ["查id", "我的id", "群組id"],
  desc: "查詢目前聊天的 User ID 或群組 ID"
  handler: async (client, event) => {
    const s = event.source;
    const text =
      s.type === "group" ? `📌 群組 ID：${s.groupId}` :
      s.type === "room"  ? `📌 聊天室 ID：${s.roomId}` :
                           `📌 User ID：${s.userId}`;

    await client.replyMessage(event.replyToken, {
      type: "text",
      text
    });
  }
};
