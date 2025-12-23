// sessions/sessionStore.js

const sessions = {};

// 取得或建立使用者 session
function getSession(userId) {
  if (!sessions[userId]) {
    sessions[userId] = {
      state: "IDLE"
    };
  }
  return sessions[userId];
}

// 重置 session（保留介面，之後會用到）
function resetSession(userId) {
  sessions[userId] = {
    state: "IDLE"
  };
}

module.exports = {
  getSession,
  resetSession
};
