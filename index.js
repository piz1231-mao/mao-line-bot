require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

// 讀取 LINE 設定（等你之後放進 Render 的環境變數）
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const app = express();
const client = new line.Client(config);

// Webhook 接收路由
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    // 處理所有事件（訊息、加入群組、貼圖…）
    for (const event of events) {
      await handleEvent(event);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

// 處理訊息事件
async function handleEvent(event) {
  // 只處理文字訊息
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const userMessage = event.message.text;

  // 回覆同樣的文字（測試用）
  return client.replyMessage(event.replyToken, {
    type: "text",
    text: `你說：${userMessage}`
  });
}

// Render 用的 port（官方預設）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mao Bot is running on port ${PORT}`);
});
