// ======================================================
// 毛怪公司 LINE Bot v1.0（正式版）
// 功能：
// 1. 待辦事項（文字）
// 2. 清潔檢查表（按鈕 quick reply）
// 3. TradingView 私人訊號通知
// 4. Google Sheets 資料庫
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
const CLEANING_SHEET_NAME = "清潔記錄"; // ← 你需在 Google Sheet 新增此表

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
// Google Sheet：寫入 function（共用）
// ======================================================
async function appendToSheet(sheetName, values) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values]
    }
  });
}

// ======================================================
// TradingView /tv-alert（私人通知）
// ======================================================
app.post("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let alertContent = req.body || "";
    const targetUser = process.env.TARGET_USER_ID;

    await tvAlert(client, alertContent, targetUser);

    console.log("🔥 TV ALERT 收到並已通知：", alertContent);
    res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 tv-alert Error:", err);
    res.status(500).send("ERROR");
  }
});

// ======================================================
// LINE Webhook
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
// LINE 訊息處理主程式
// ======================================================
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text;

  // ======================================================
  // 1️⃣ 清潔開始 → 推出按鈕式清單
  // ======================================================
  if (text === "清潔開始") {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "🧹 請選擇要回報的清潔項目：",
      quickReply: {
        items: [
          { type: "action", action: { type: "message", label: "桌面擦拭", text: "清潔：桌面擦拭" }},
          { type: "action", action: { type: "message", label: "地板無積水", text: "清潔：地板無積水" }},
          { type: "action", action: { type: "message", label: "冷藏櫃把手清潔", text: "清潔：冷藏櫃把手清潔" }},
          { type: "action", action: { type: "message", label: "備料台整潔", text: "清潔：備料台整潔" }},
          { type: "action", action: { type: "message", label: "餐具區清潔", text: "清潔：餐具區清潔" }},
          { type: "action", action: { type: "message", label: "垃圾桶更換", text: "清潔：垃圾桶更換" }},
          { type: "action", action: { type: "message", label: "排水溝清理", text: "清潔：排水溝清理" }},
          { type: "action", action: { type: "message", label: "餐具補滿", text: "清潔：餐具補滿" }},
        ]
      }
    });
  }

  // ======================================================
  // 2️⃣ 清潔紀錄寫入（按按鈕後）
  // ======================================================
  if (text.startsWith("清潔：")) {
    const item = text.replace("清潔：", "").trim();
    const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    const values = [
      timestamp,
      event.source.groupId || "個人",
      event.source.userId,
      item,
      "完成"
    ];

    await appendToSheet(CLEANING_SHEET_NAME, values);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `🧽 已完成清潔：「${item}」`
    });
  }

  // ======================================================
  // 3️⃣ 待辦事項
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

  // 其他訊息 → 不回覆
  return;
}

// ======================================================
// Render 啟動
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mao Bot v1.0 running on PORT ${PORT}`);
});
