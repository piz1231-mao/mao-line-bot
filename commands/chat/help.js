module.exports = {
  keywords: ["help", "指令", "說明", "功能"],
  desc: "查看目前可用的所有指令",
  handler: async (client, event) => {
    const list = global.MAO_COMMANDS || [];

    if (!list.length) {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 目前沒有可用指令"
      });
      return;
    }

    let text = "📖 毛怪秘書｜功能指令一覽\n━━━━━━━━━━━\n";

    list.forEach(cmd => {
      const keys = cmd.keywords.join(" / ");
      const desc = cmd.desc || "（尚未提供說明）";

      // 👉 簡單 emoji 規則（先夠用）
      let icon = "🔹";
      if (keys.includes("待辦")) icon = "📝";
      else if (keys.includes("查") || keys.includes("id")) icon = "🆔";
      else if (keys.includes("面試") || keys.includes("錄取")) icon = "👥";
      else if (keys.includes("help") || keys.includes("指令")) icon = "ℹ️";

      text += `${icon} ${keys}\n${desc}\n\n`;
    });

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: text.trim()
    });
  }
};
