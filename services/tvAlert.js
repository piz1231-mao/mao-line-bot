const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const fs = require("fs");
const { buildTVFlex } = require("./tvAlert.flex");

// ======================================================
// Google Sheet 設定（TV 通知名單）
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const SHEET_NAME = "TV通知名單";

// ======================================================
// Google Auth
// ======================================================
const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);

const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// 取得 LINE 通知名單（防爆）
// ======================================================
async function getNotifyListSafe() {
  try {
    const c = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: c });

    const rows = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:B999`
    });

    return (rows.data.values || [])
      .map(r => (r[1] || "").trim())
      .filter(id => id.startsWith("U") || id.startsWith("C"));
  } catch (err) {
    console.error("❌ Google Sheets 讀取失敗：", err.message);
    return [];
  }
}

// ======================================================
// 工具：字串解析
// ======================================================
function extract(text, key) {
  if (typeof text !== "string") return null;
  const m = text.match(new RegExp(`${key}=([^|\\s]+)`, "i"));
  return m ? m[1] : null;
}

// ======================================================
// 🧠 毛怪嘴砲邏輯（⚠️ 定版鎖死，不可修改）
// ======================================================
function maoTalk({ tf, excess }) {
  const e = Number(excess) || 0;
  const isLTF = tf === "3";

  if (isLTF) {
    if (e <= 5)  return "有在動了啦，先看不要急 👀";
    if (e <= 10) return "這個開始有點樣子了，不看會後悔";
    return "3 分就這樣了，5 分不出我不信";
  } else {
    if (e <= 5)  return "條件過了，但不是那種一定要衝的";
    if (e <= 10) return "條件到齊，這種不進說不過去";
    return "這種你不進，盤後一定怪我";
  }
}

// ======================================================
// TradingView → LINE（全送、不篩）
// ======================================================
module.exports = async function tvAlert(client, alertContent) {
  console.log("🧪 tvAlert triggered");

  let payload = {};
  let text = "";

  if (typeof alertContent === "string") {
    text = alertContent;
  } else if (typeof alertContent === "object" && alertContent !== null) {
    payload = alertContent;
    text = JSON.stringify(alertContent);
  }

  console.log("📩 RAW ALERT:", text);

  // ---------- 方向（不再作為擋訊號條件） ----------
  let direction = null;
  if (/BUY/i.test(text))  direction = "買進";
  if (/SELL/i.test(text)) direction = "賣出";
  if (!direction) direction = "提醒";

  // ---------- 解析資料 ----------
  const tfRaw  = payload.tf     || extract(text, "tf")     || "";
  const price  = payload.price  || extract(text, "price")  || "—";
  const sl     = payload.sl     || extract(text, "sl")     || "—";
  const excess = payload.excess || extract(text, "excess") || "0";

  const tfDisplay =
    /^\d+$/.test(tfRaw) ? `${tfRaw} 分 K`
    : tfRaw === "D"     ? "日 K"
    : tfRaw === "W"     ? "週 K"
    : "未指定";

  const talk = maoTalk({ tf: tfRaw, excess });

  const timeText = new Date().toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const ids = await getNotifyListSafe();
  if (!ids.length) return;

  let msg;
  try {
    msg = buildTVFlex({
      timeframe: tfDisplay,
      direction,
      talk,
      price,
      stopLoss: sl,
      timeText
    });
  } catch (err) {
    console.error("❌ Flex 建立失敗：", err.message);
    return;
  }

  for (const id of ids) {
    try {
      await client.pushMessage(id, msg);
      console.log("✅ TV 推播成功：", id);
    } catch (err) {
      console.error("❌ TV 推播失敗：", id, err.message);
    }
  }
};
