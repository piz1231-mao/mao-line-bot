// ======================================================
// 毛怪秘書 LINE Bot — index.js
// 穩定完整版 v1.2.1
//
// - TradingView Webhook（鎖死）
// - 天氣查詢（縣市完整）
// - 待辦功能
// - 🚄 高鐵查詢
// - 私訊營運回報（三店分頁）
//   ✔ 成功不回應
//   ✔ 失敗才回應
// - 摘要寫入 Q 欄（emoji）
// - 查業績：單店 / 三店合併（A 分隔線）
// - ⏰ 每日 08:00 主動推播（/api/daily-summary）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const axios = require("axios");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");

const app = express();

// ======================================================
// services（原有）
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");
const tvAlert = require("./services/tvAlert");
const todoCmd = require("./commands/chat/todo");
const handleHSR = require("./handlers/hsr");

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// ======================================================
// Google Sheet 設定
// ======================================================
const SPREADSHEET_ID = "11efjOhFI_bY-zaZZw9r00rLH7pV1cvZInSYLWIokKWk";
const TEMPLATE_SHEET = "茶六博愛";
const SHOP_LIST = ["茶六博愛", "三山博愛", "湯棧中山"];

const credentials = JSON.parse(
  fs.readFileSync("/etc/secrets/google-credentials.json", "utf8")
);
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

// ======================================================
// TradingView Webhook
// ======================================================
app.all("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let body = {};
    if (typeof req.body === "string") {
      try { body = JSON.parse(req.body); } catch {}
    }
    const msg = body.message || body.alert || req.body;
    await tvAlert(client, msg, body);
    res.send("OK");
  } catch (e) {
    console.error("TV error", e);
    res.send("OK");
  }
});

// ======================================================
// 工具
// ======================================================
const nowTW = () =>
  new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
const num = v => (v ? Number(String(v).replace(/,/g, "")) : "");

// ======================================================
// 天氣
// ======================================================
function parseWeather(text) {
  if (text === "天氣" || text.startsWith("天氣 ")) {
    return text.replace("天氣", "").trim();
  }
  return null;
}
const CITY_MAP = {
  台北:"臺北市",臺北:"臺北市",新北:"新北市",桃園:"桃園市",
  台中:"臺中市",臺中:"臺中市",台南:"臺南市",臺南:"臺南市",
  高雄:"高雄市",基隆:"基隆市",新竹:"新竹市",苗栗:"苗栗縣",
  彰化:"彰化縣",南投:"南投縣",雲林:"雲林縣",嘉義:"嘉義市",
  屏東:"屏東縣",宜蘭:"宜蘭縣",花蓮:"花蓮縣",
  台東:"臺東縣",臺東:"臺東縣",澎湖:"澎湖縣",金門:"金門縣",連江:"連江縣"
};

// ======================================================
// 解析業績
// ======================================================
function parseSales(text) {
  const t = text.replace(/：/g,":").replace(/。/g,".").replace(/％/g,"%");
  const d = t.match(/(\d{1,2})\/(\d{1,2})/);
  return {
    date: d ? `${new Date().getFullYear()}-${d[1].padStart(2,"0")}-${d[2].padStart(2,"0")}` : "",
    revenue: num(t.match(/(?:業績|總業績)\s*:\s*([\d,]+)/)?.[1]),
    unit: t.match(/客單價\s*:\s*([\d.]+)/)?.[1] || "",
    qty: num(t.match(/(?:套餐份數|總鍋數)\s*:\s*([\d,]+)/)?.[1]),
    fp: t.match(/外場薪資\s*:\s*([\d,]+).*?([\d.]+)%/)?.slice(1) || [],
    bp: t.match(/內場薪資\s*:\s*([\d,]+).*?([\d.]+)%/)?.slice(1) || []
  };
}

// ======================================================
// 確保 Sheet
// ======================================================
async function ensureSheet(shop) {
  if (shop === TEMPLATE_SHEET) return;
  const c = await auth.getClient();
  const sheets = google.sheets({ version:"v4", auth:c });
  const meta = await sheets.spreadsheets.get({ spreadsheetId:SPREADSHEET_ID });
  if (meta.data.sheets.some(s=>s.properties.title===shop)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId:SPREADSHEET_ID,
    requestBody:{requests:[{addSheet:{properties:{title:shop}}}]}
  });
  const header = await sheets.spreadsheets.values.get({
    spreadsheetId:SPREADSHEET_ID,
    range:`${TEMPLATE_SHEET}!A1:Q1`
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId:SPREADSHEET_ID,
    range:`${shop}!A1:Q1`,
    valueInputOption:"USER_ENTERED",
    requestBody:{values:header.data.values}
  });
}

// ======================================================
// 寫入業績
// ======================================================
async function writeShop(shop, text, userId) {
  const c = await auth.getClient();
  const sheets = google.sheets({ version:"v4", auth:c });
  const p = parseSales(text);
  const qtyLabel = shop==="湯棧中山"?"總鍋數":"套餐數";

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId:SPREADSHEET_ID,
    range:`${shop}!A1`,
    valueInputOption:"USER_ENTERED",
    requestBody:{values:[[nowTW(),userId,userId,text,shop,p.date,p.revenue,"業績",p.qty,p.unit,
      num(p.fp[0]),Number(p.fp[1]||""),num(p.bp[0]),Number(p.bp[1]||""),
      num(p.fp[0])+num(p.bp[0]),Number(p.fp[1]||0)+Number(p.bp[1]||0)
    ]]}
  });

  const row = res.data.updates.updatedRange.match(/\d+/)[0];
  const summary =
`【${shop}｜${p.date.slice(5)}】

💰 業績：${p.revenue}

📦 ${qtyLabel}：${p.qty}
🧾 客單價：${p.unit}

👥 人事
外場：${p.fp[0]}（${p.fp[1]}%）
內場：${p.bp[0]}（${p.bp[1]}%）
總計：${num(p.fp[0])+num(p.bp[0])}（${Number(p.fp[1]||0)+Number(p.bp[1]||0)}%）`;

  await sheets.spreadsheets.values.update({
    spreadsheetId:SPREADSHEET_ID,
    range:`${shop}!Q${row}`,
    valueInputOption:"USER_ENTERED",
    requestBody:{values:[[summary]]}
  });
}

// ======================================================
// Webhook
// ======================================================
app.post("/webhook", line.middleware(config), async (req,res)=>{
  for (const e of req.body.events||[]) {
    if (await handleHSR(e)) continue;
    if (e.message?.type==="text" && e.message.text.startsWith("大哥您好")) {
      const shop = e.message.text.includes("湯棧")?"湯棧中山":
                   e.message.text.includes("三山")?"三山博愛":"茶六博愛";
      await ensureSheet(shop);
      await writeShop(shop, e.message.text, e.source.userId);
      continue;
    }
    if (e.message?.type==="text" && e.message.text.startsWith("查業績")) {
      const arg = e.message.text.split(" ")[1];
      const c = await auth.getClient();
      const sheets = google.sheets({version:"v4",auth:c});
      let out=[];
      for (const s of SHOP_LIST) {
        if (arg && s!==arg) continue;
        const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:`${s}!Q:Q`});
        const list=r.data.values?.map(v=>v[0]).filter(Boolean)||[];
        if(list.length) out.push(list.at(-1));
      }
      await client.replyMessage(e.replyToken,{type:"text",text:out.join("\n\n━━━━━━━━━━━\n\n")||"目前沒有資料"});
      continue;
    }
    if (e.message?.type==="text") {
      const city=parseWeather(e.message.text);
      if (city!==null) {
        const r=await get36hrWeather(CITY_MAP[city]||"高雄市");
        await client.replyMessage(e.replyToken,{type:"text",text:buildWeatherFriendText(r)});
      }
    }
  }
  res.send("OK");
});

// ======================================================
// 每日摘要 API（給 Cron）
// ======================================================
app.post("/api/daily-summary", async (req,res)=>{
  const c = await auth.getClient();
  const sheets = google.sheets({version:"v4",auth:c});
  let out=[];
  for (const s of SHOP_LIST) {
    const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:`${s}!Q:Q`});
    const list=r.data.values?.map(v=>v[0]).filter(Boolean)||[];
    if(list.length) out.push(list.at(-1));
  }
  if(!out.length) return res.send("no data");
  await client.pushMessage(process.env.BOSS_USER_ID,{type:"text",text:out.join("\n\n━━━━━━━━━━━\n\n")});
  res.send("ok");
});

app.listen(process.env.PORT||3000);
