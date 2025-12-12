// ======================================================
// 毛怪公司 LINE Bot v2.2 — 最終正式版
// 功能：
// 1. 待辦事項（智能 Text Parser｜全形/半形兼容）
// 2. TradingView 訊號 → Google Sheet 名單推播
// 3. 通知名單管理：加入 / 移除 / 查詢
// 4. 查詢自己的 UserID / 群組ID
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const tvAlert = require("./commands/tvAlert");

// ===== LINE 設定 =====
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

const app = express();
const client = new line.Client(config);

// ===== Google Sheet 設定 =====
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const TODO_SHEET_NAME = "待辦事項";
const NOTIFY_SHEET_NAME = "TV通知名單";

// ===== 讀取金鑰 =====
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ===== Sheet 寫入 =====
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

// ===== Sheet 刪除 =====
async function deleteRowByUserID(uid) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const getRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${NOTIFY_SHEET_NAME}!A2:B999`
  });

  const rows = getRows.data.values || [];
  let rowIndex = -1;

  rows.forEach((r, idx) => {
    if (r[1] === uid) rowIndex = idx + 2; // A2 是第 2 列
  });

  if (rowIndex === -1) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0,
            dimension: "ROWS",
            startIndex: rowIndex - 1,
            endIndex: rowIndex
          }
        }
      }]
    }
  });

  return true;
}

// ======================================================
// TradingView Webhook
// ======================================================
app.post("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    const alertContent = req.body || "";
    await tvAlert(client, alertContent);

    console.log("🔥 TV ALERT → 已推播：", alertContent);
    res.status(200).send("OK");
  } catch (err) {
    console.error("TV-alert Error:", err);
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
// 🧠 對話暫存（加入通知流程用）
// ======================================================
let pendingName = null;

// ======================================================
// 主指令處理
// ======================================================
async function handleEvent(event) {

  if (event.type !== "message" || event.message.type !== "text") return;

  const rawText = event.message.text;
  const text = rawText.trim();
  const clean = text.replace(/\s/g, "");  // 移除空白（提升容錯）

  // ============================================
  // 1️⃣ 查 User ID / Group ID（最高優先）
  // ============================================
  if (clean.includes("我的ID") || clean.includes("查ID")) {

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

  // ============================================
  // 2️⃣ 加入通知（Step 1）
  // ============================================
  if (text.startsWith("加入通知：")) {
    pendingName = text.replace("加入通知：", "").trim();

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `請輸入【${pendingName}】的 User ID（格式：Uxxxxxx）\n例如：\n加入通知ID：Uxxxxxx`
    });
  }

  // ============================================
  // 3️⃣ 加入通知（Step 2）
  // ============================================
  if (text.startsWith("加入通知ID：")) {
    if (!pendingName) {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 你還沒輸入名字！格式：加入通知：小陳"
      });
    }

    const uid = text.replace("加入通知ID：", "").trim();

    await appendToSheet(NOTIFY_SHEET_NAME, [pendingName, uid]);

    const doneName = pendingName;
    pendingName = null;

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ 已加入通知名單：${doneName}`
    });
  }

  // ============================================
  // 4️⃣ 移除通知
  // ============================================
  if (text.startsWith("移除通知：")) {
    const uid = text.replace("移除通知：", "").trim();
    const success = await deleteRowByUserID(uid);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: success ? "🗑 已成功移除通知名單！" : "❌ 找不到此 User ID"
    });
  }

  // ============================================
  // 5️⃣ 查詢通知名單
  // ============================================
  if (text === "查通知名單") {
    const client2 = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client2 });

    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIFY_SHEET_NAME}!A2:B999`
    });

    const rows = data.data.values || [];
    
    if (rows.length === 0) {
      return client.replyMessage(event.replyToken, { type: "text", text: "目前沒有通知名單。" });
    }

    let reply = "📢 TV 通知名單：\n\n";
    rows.forEach((r, i) => {
      reply += `${i + 1}. ${r[0] || "未命名"}\n`;
    });

    return client.replyMessage(event.replyToken, { type: "text", text: reply });
  }

  // ============================================
  // 6️⃣ 待辦事項（萬用冒號，全形/半形/空格皆可）
  // ============================================
  if (clean.startsWith("待辦：") || clean.startsWith("待辦:")) {
    const task = text.split(/[:：]/)[1]?.trim();

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

  // ============================================
  // 其他訊息 → 不回覆
  // ============================================
  return;
}

// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Mao Bot v2.2 Running on PORT ${PORT}`);
});
