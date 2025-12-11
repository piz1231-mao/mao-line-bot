require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const tvAlert = require("./commands/tvAlert");

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const app = express();
const client = new line.Client(config);

// ⚠️ 千萬不要用 express.json()（會阻擋 TradingView）
// app.use(express.json());  ← 永遠不要寫這個

// === TradingView alert 接收（放最前面並強制 text parser）===
app.post("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let alertContent = req.body || "";

    if (typeof alertContent !== "string") {
      alertContent = String(alertContent);
    }

    const targetUser = process.env.TARGET_USER_ID;
    await tvAlert(client, alertContent, targetUser);

    console.log("🔥 TV ALERT 收到內容：", alertContent);

    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 TV-alert error:", err);
    res.status(500).send("ERROR");
  }
});

// === Google Sheets 設定 ===
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "待辦事項";

const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function appendRow(values) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values]
    }
  });
}

// === LINE webhook ===
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events) {
      await handleEvent(event);
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).end();
  }
});

// === LINE 訊息處理 ===
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  if (text.startsWith("待辦：")) {
    const task = text.replace("待辦：", "").trim();
    const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    const values = [
      timestamp,
      event.source.groupId || "個人",
      event.source.userId,
      task,
      "未完成"
    ];

    await appendRow(values);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `📌 已記錄待辦：「${task}」`
    });
  }
}

// === 啟動服務 ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mao Bot running on PORT ${PORT}`);
});
