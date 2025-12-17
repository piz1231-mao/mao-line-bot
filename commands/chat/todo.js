const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");

// ===== Google Sheet 設定 =====
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "待辦事項";

// ===== Google Auth =====
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ===== 寫入 Sheet =====
async function appendTodo(values) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

module.exports = {
  keywords: ["待辦"],
  handler: async (lineClient, event) => {
    const text = event.message.text;
    const task = text.split(/[:：]/)[1]?.trim();

    if (!task) {
      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "⚠️ 格式錯誤\n請使用：待辦：事項內容"
      });
      return;
    }

    const timestamp = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei"
    });

    const sourceId =
      event.source.groupId ||
      event.source.roomId ||
      event.source.userId;

    try {
      await appendTodo([
        timestamp,
        sourceId,
        event.source.userId,
        task,
        "未完成"
      ]);

      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: `📌 已新增待辦並記錄\n👉 ${task}`
      });
    } catch (err) {
      console.error("❌ 待辦寫入失敗", err);

      await lineClient.replyMessage(event.replyToken, {
        type: "text",
        text: "❌ 待辦已接收，但寫入試算表失敗"
      });
    }
  }
};
