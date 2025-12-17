module.exports = {
  keywords: ["help", "指令", "說明"],
  desc: "查看目前可用的所有指令",
  handler: async (client, event) => {
    const list = global.MAO_COMMANDS || [];

    if (!list.length) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 目前沒有載入任何指令"
      });
      return;
    }

    let text = "📖 毛怪秘書 功能指令一覽\n━━━━━━━━━━━\n";

    list.forEach(cmd => {
      const keys = cmd.keywords.join(" / ");
      text += `• ${keys}\n  ${cmd.desc}\n`;
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text
    });
  }
};
