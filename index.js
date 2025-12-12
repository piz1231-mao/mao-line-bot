// ======================================================
// 毛怪公司 LINE Bot v1.1（正式版）
// 功能：
// 1. 待辦事項（文字 → 寫入 Google Sheet）
// 2. TradingView 私人訊號通知（多人）
// 3. 回覆 User ID / Group ID（管理用）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const tvAlert = require("./commands/tvAlert");

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const app = express();
const client = new line.Client(config);

// ======================================================
// Google Sheets 設定
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const TODO_SHEET_NAME = "待辦事項";

// 讀取 Secret File（金鑰）
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

// 建立 Google API 授權
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// Google Sheet：寫入 function（可共用）
// ======================================================
async function appendToSheet(sheetName, values) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

// ======================================================
// TradingView 訊號 /tv-alert → 可通知多人
// ======================================================
app.post("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const alertContent = req.body || "";
    const targetUserList = process.env.TV_TARGET_IDS || ""; // 多人 ID，用逗號分隔

    await tvAlert(client, alertContent, targetUserList);

    console.log("🔥 TV ALERT 已通知：", alertContent);
    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 tv-alert Error：", err);
    res.status(500).send("ERROR");
  }
});

// ======================================================
// LINE Webhook 主入口
// ======================================================
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

// ======================================================
// LINE 訊息處理邏輯
// ======================================================
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

 // === 回傳 User ID / Group ID（智慧比對，任何「我的ID」都可以） ===
if (text.replace(/\s/g, "").includes("我的ID")
 || text.replace(/\s/g, "").includes("我的id")
 || text.replace(/\s/g, "").includes("查ID")
 || text.replace(/\s/g, "").includes("查id")) {

    const uid = event.source.userId || null;
    const gid = event.source.groupId || null;

    if (gid) {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: `📌 群組 ID：\n${gid}\n\n請截圖給阿毛。`
      });
    } else {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: `📌 你的 User ID：\n${uid}\n\n請截圖給阿毛。`
      });
    }
}

  // ======================================================
  // 2️⃣ 待辦事項（格式：待辦：內容）
  // ======================================================
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

    await appendToSheet(TODO_SHEET_NAME, values);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `📌 已記錄待辦：「${task}」`
    });
  }

  // ======================================================
  // 其他訊息不回應（保持安靜）
  // ======================================================
  return;
}

// ======================================================
// Render 伺服器啟動
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mao Bot v1.1 running on PORT ${PORT}`);
});
