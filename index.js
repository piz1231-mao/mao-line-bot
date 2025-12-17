// ======================================================
// 毛怪祕書 LINE Bot v2.3 — 整合修正版
// 功能：
// 1. 待辦事項（萬用冒號、自動字元解析）
// 2. TradingView 訊號 → Google Sheet 名單推播
// 3. 通知名單管理（加入 / 移除 / 查名單）
// 4. 強化查 UserID / GroupID / RoomID
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

// ===== 金鑰 =====
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ===== Sheet 寫入 =====
async function appendToSheet(sheetName, values) {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

// ===== Sheet 刪除（移除通知名單） =====
async function deleteRowByUserID(uid) {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const rowsData = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${NOTIFY_SHEET_NAME}!A2:B999`
  });

  const rows = rowsData.data.values || [];
  let rowIndex = -1;

  rows.forEach((r, idx) => {
    if (r[1] === uid) rowIndex = idx + 2;
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
// TradingView webhook（最終穩定版）
// ======================================================
app.post("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let body = {};
    let content = "";
    const raw = req.body || "";

    if (typeof raw === "string") {
      try {
        body = JSON.parse(raw);
      } catch {
        content = raw;
      }
    } else if (typeof raw === "object") {
      body = raw;
    }

    if (body && typeof body === "object") {
      content = body.message || body.alert || content;
    }

    const price = body.close ?? body.price ?? null;

    await tvAlert(client, content, {
      ...body,
      price
    });

    console.log("🔥 毛怪祕書 TV 訊號推播：", content || body);
    res.status(200).send("OK");
  } catch (err) {
    console.error("TV Error:", err);
    res.status(500).send("ERROR");
  }
});

// ======================================================
// LINE Webhook
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const e of req.body.events) {
      await handleEvent(e);
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("LINE Webhook Error:", err);
    res.status(500).end();
  }
});

// ======================================================
// 對話狀態
// ======================================================
const pendingMap = new Map();

// ======================================================
// 主指令處理
// ======================================================
async function handleEvent(event) {
  // 僅處理文字訊息
  if (!event.message || event.message.type !== "text") return;

  const text = event.message.text.trim();
  const clean = text.replace(/\s/g, "");

  // ============================================
  // 1️⃣ 查 UserID / GroupID（優化判斷邏輯）
  // ============================================
  if (clean.includes("我的ID") || clean.includes("查ID")) {
    const source = event.source;
    let replyText = "";

    // 優先判斷是否在群組
    if (source.type === "group") {
      replyText = `📌 本群組 ID：\n${source.groupId}`;
    } 
    // 次之判斷是否在多人聊天室 (舊式)
    else if (source.type === "room") {
      replyText = `📌 本聊天室 ID：\n${source.roomId}`;
    } 
    // 最後則是個人 ID
    else {
      replyText = `📌 你的 User ID：\n${source.userId}`;
    }

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: replyText
    });
  }

  // ============================================
  // 2️⃣ 加入通知 Step1
  // ============================================
  if (text.startsWith("加入通知：")) {
    const name = text.replace("加入通知：", "").trim();
    pendingMap.set(event.source.userId, name);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `請輸入【${name}】的 User ID（或群組 ID）\n格式：加入通知ID：Uxxxx 或 Cxxxx`
    });
  }

  // ============================================
  // 3️⃣ 加入通知 Step2
  // ============================================
  if (text.startsWith("加入通知ID：")) {
    const uid = text.replace("加入通知ID：", "").trim();
    const name = pendingMap.get(event.source.userId);

    if (!name) {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 你還沒有輸入「加入通知：名字」"
      });
    }

    await appendToSheet(NOTIFY_SHEET_NAME, [name, uid]);
    pendingMap.delete(event.source.userId);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `✅ 已加入通知名單：${name}`
    });
  }

  // ============================================
  // 4️⃣ 移除通知
  // ============================================
  if (text.startsWith("移除通知：")) {
    const uid = text.replace("移除通知：", "").trim();
    const ok = await deleteRowByUserID(uid);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: ok ? "🗑 已移除通知名單！" : "❌ 找不到此 ID"
    });
  }

  // ============================================
  // 5️⃣ 查通知名單
  // ============================================
  if (text === "查通知名單") {
    const c2 = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: c2 });

    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${NOTIFY_SHEET_NAME}!A2:B999`
    });

    const rows = data.data.values || [];

    if (rows.length === 0) {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "📭 目前通知名單為空。"
      });
    }

    let reply = "📢 毛怪祕書 TV 通知名單：\n\n";
    rows.forEach((r, i) => reply += `${i + 1}. ${r[0]}\n`);

    return client.replyMessage(event.replyToken, {
      type: "text",
      text: reply
    });
  }

  // ============================================
  // 6️⃣ 待辦（支援所有冒號形式）
  // ============================================
  if (clean.startsWith("待辦")) {
    const parts = text.split(/[:：﹕꞉]/); 
    const task = parts[1]?.trim();

    if (!task) {
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 格式錯誤：請使用\n待辦：事項內容"
      });
    }

    const timestamp = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    await appendToSheet(TODO_SHEET_NAME, [
      timestamp,
      event.source.groupId || event.source.roomId || "個人",
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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪祕書 v2.3 Running on PORT ${PORT}`);
});
