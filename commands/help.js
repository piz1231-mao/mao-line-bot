module.exports = async function handleHelp(client, event) {
  const text =
`📖 毛怪秘書指令表
━━━━━━━━━━━
📌 查ID / 群組ID
📝 待辦：事項
📢 TradingView 訊號（自動）
`;

  await client.replyMessage(event.replyToken, {
    type: "text",
    text
  });
};
