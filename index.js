// ======================================================
// 毛怪祕書 LINE Bot v2.3 — 含指令表最終版
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

// ===== Google Auth =====
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// 指令表定義（單一真實來源）
// ======================================================
const COMMANDS = [
  {
    group: "📌 基本功能",
    items: [
      { cmd: "查ID / 查群組 / 群組ID", desc: "顯示目前聊天的 ID（User / Group / Room）" },
      { cmd: "help / 指令", desc: "顯示毛怪祕書指令表" }
    ]
  },
  {
    group: "📝 待辦事項",
    items: [
      { cmd: "待辦：事項內容", desc: "新增一筆待辦事項" }
    ]
  },
  {
    group: "📢 通知管理",
    items: [
      { cmd: "加入通知：名字", desc: "設定通知對象（Step 1）" },
      { cmd: "加入通知ID：Uxxxx / Cxxxx", desc: "綁定通知 ID（Step 2）" },
      { cmd: "移除通知：ID", desc: "移除通知名單" },
      { cmd: "查通知名單", desc: "查看目前通知名單" }
    ]
  }
];

// ===== 指令表文字產生 =====
function buildHelpText() {
  let text = "📖 毛怪祕書 指令表\n━━━━━━━━━━━\n";

  COMMANDS.forEach(section => {
    text += `\n${section.group}\n`;
    section.items.forEach(i => {
      text += `- ${i.cmd}\n  ${i.desc}\n`;
    });
  });

  return text.trim();
}

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

// ===== LINE Webhook =====
app.post("/webhook", line.middleware(config), async (req, res) => {
  for (const e of req.body.events) {
    await handleEvent(e);
  }
  res.status(200).send("OK");
});

// ======================================================
// 主指令處理
// ======================================================
async function handleEvent(event) {
  if (!event.message || event.message.type !== "text") return;

  const text = event.message.text.trim();
  const clean = text.replace(/\s/g, "");
  const cleanLower = clean.toLowerCase();

  // ===== help 指令 =====
  if (["help", "指令", "說明"].includes(cleanLower)) {
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: buildHelpText()
    });
  }

  // ===== 查 ID =====
  const idAliases = ["查id", "我的id", "查群組", "群組id"];
  if (idAliases.some(cmd => cleanLower.includes(cmd))) {
    const s = event.source;
    const reply =
      s.type === "group" ? `📌 本群組 ID：\n${s.groupId}` :
      s.type === "room"  ? `📌 本聊天室 ID：\n${s.roomId}` :
                           `📌 你的 User ID：\n${s.userId}`;

    return client.replyMessage(event.replyToken, { type: "text", text: reply });
  }

  // ===== 待辦 =====
  if (clean.startsWith("待辦")) {
    const task = text.split(/[:：﹕꞉]/)[1]?.trim();
    if (!task) return;

    await appendToSheet(TODO_SHEET_NAME, [
      new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
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
app.listen(3000, () => {
  console.log("🚀 毛怪祕書 v2.3（含指令表）已啟動");
});
