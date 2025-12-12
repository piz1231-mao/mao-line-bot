const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");

// Google Sheet 設定
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "TV通知名單";

// 讀取金鑰
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

async function getNotifyList() {
  const c = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: c });

  const rows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:B999`
  });

  return (rows.data.values || [])
    .map(r => r[1])
    .filter(Boolean); // 避免空 ID
}

module.exports = async function tvAlert(client, alertContent, rawBody = null) {
  const ids = await getNotifyList();

  // ✅ 防呆：確保一定有內容
  let safeContent = "TradingView 訊號（無內容）";

  if (typeof alertContent === "string" && alertContent.trim()) {
    safeContent = alertContent.trim();
  } else if (rawBody) {
    // fallback：直接把 TV payload 印出來
    safeContent = JSON.stringify(rawBody, null, 2);
  }

  const msg = {
    type: "text",
    text:
      `📢 毛怪祕書｜TradingView 訊號\n` +
      `----------------------\n` +
      safeContent
  };

  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ 已通知：", id);
    } catch (err) {
      console.error("❌ 通知失敗：", id, err?.originalError || err);
    }
  }
};
