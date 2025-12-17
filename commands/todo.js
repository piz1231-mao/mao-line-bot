const { appendTodo } = require("../modules/sheet");

module.exports = async function handleTodo(client, event) {
  const text = event.message.text;
  const task = text.split(/[:：]/)[1]?.trim();

  if (!task) return;

  await appendTodo({
    userId: event.source.userId,
    groupId: event.source.groupId || "個人",
    task
  });

  await client.replyMessage(event.replyToken, {
    type: "text",
    text: `📌 已記錄待辦：${task}`
  });
};
