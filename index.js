// ======================================================
// 毛怪公司 LINE Bot v2.0（企業級通知管理）
// 功能：
// 1. 待辦事項（Google Sheet）
// 2. TradingView 訊號 → Google Sheet 名單推播
// 3. 通知名單管理（加入 / 移除 / 查名單）
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
const NOTIFY_SHEET_NAME = "TV通知名單";

// Google 金鑰
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

// Google API 授權
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// Google Sheet 寫入
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

// Google Sheet 刪除一列
async function deleteRowByUserID(targetID) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${NOTIFY_SHEET_NAME}!A2:B999`,
  });

  const rows = data.data.values || [];
  let rowIndex = -1;

  rows.forEach((r, i) => {
    if (r[1] === targetID) rowIndex = i + 2; // +2 因為 A2 是第 2 列
  });

  if (rowIndex === -1) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }
      ]
    }
  });

  return true;
}

// ======================================================
// TradingView Webhook
// ======================================================
app.post("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let alertContent = req.body || "";
    await tvAlert(client, alertContent);

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
// LINE 訊息主處理
// ======================================================
async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;

  const text = event.message.text.trim();

  // ⭐ 查詢使用者與群組 ID
  if (text.replace(/\s/g, "").includes("我的ID")) {
    const uid = event.source.userId;
    const gid = event.source.groupId;

    if (gid) {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: `📌 群組 ID：\n${gid}`
      });
    }

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `📌 你的 User ID：\n${uid}`
    });
  }

  // ⭐ 加入通知名單（加入通知：名字 使用者ID）
  if (text.startsWith("加入通知：")) {
    const name = text.replace("加入通知：", "").trim();

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `請輸入 ${name} 的 User ID（格式：Uxxxxxx）\n輸入方式：\n加入通知ID：UserID`
    });
  }

  // ⭐ 實際寫入通知名單
  if (text.startsWith("加入通知ID：")) {
    const uid = text.replace("加入通知ID：", "").trim();

    await appendToSheet(NOTIFY_SHEET_NAME, ["未命名", uid]);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: "✅ 已加入 TV 通知名單！"
    });
  }

  // ⭐ 移除通知名單：移除通知：UserID
  if (text.startsWith("移除通知：")) {
    const uid = text.replace("移除通知：", "").trim();

    const result = await deleteRowByUserID(uid);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: result ? "🗑 已成功移除通知名單！" : "找不到此 UserID。"
    });
  }

  // ⭐ 查詢通知名單
  if (text === "查通知名單") {
    const client2 = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client2 });

    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIFY_SHEET_NAME}!A2:B999`
    });

    const rows = data.data.values || [];
    let reply = "📢 目前通知名單：\n\n";

    rows.forEach((r, i) => {
      reply += `${i + 1}. ${r[0] || "未命名"}\n`;
    });

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: reply
    });
  }

  // ⭐ 待辦事項
  if (text.startsWith("待辦：")) {
    const task = text.replace("待辦：", "").trim();
    const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    await appendToSheet(TODO_SHEET_NAME, [
      timestamp,
      event.source.groupId || "個人",
      event.source.userId,
      task,
      "未完成"
    ]);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `📌 已記錄待辦：「${task}」`
    });
  }
}

// ======================================================
// Render 啟動
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mao Bot v2.0 running on PORT ${PORT}`);
});
