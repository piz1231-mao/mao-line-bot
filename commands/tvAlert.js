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

  return (rows.data.values || []).map(r => r[1]); // UserID
}

module.exports = async function tvAlert(client, alertContent) {
  const ids = await getNotifyList();

  const msg = {
    type: "text",
    text: `📢 毛怪祕書：TradingView 訊號\n\n${alertContent}`
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
