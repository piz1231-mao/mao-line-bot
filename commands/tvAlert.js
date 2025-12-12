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
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:B999`,
  });

  const rows = result.data.values || [];
  return rows.map(r => r[1]); // 回傳每個 UserID
}

module.exports = async function tvAlert(client, alertContent) {
  const ids = await getNotifyList();

  const msg = {
    type: "text",
    text: `📢 TradingView 訊號：\n${alertContent}`
  };

  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("已通知：", id);
    } catch (err) {
      console.error("通知失敗：", id, err);
    }
  }
};
