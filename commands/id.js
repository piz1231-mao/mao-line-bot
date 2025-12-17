module.exports = async function handleId(client, event) {
  const s = event.source;

  const text =
    s.type === "group" ? `📌 本群組 ID：\n${s.groupId}` :
    s.type === "room"  ? `📌 本聊天室 ID：\n${s.roomId}` :
                         `📌 你的 User ID：\n${s.userId}`;

  await client.replyMessage(event.replyToken, {
    type: "text",
    text
  });
};
