// sessions/sessionStore.js
const sessions = {};

/**
 * sessionKey 格式：
 * userId:sourceId
 * - 私訊：userId:userId
 * - 群組：userId:groupId
 * - room ：userId:roomId
 */
function getSession(sessionKey) {
  if (!sessions[sessionKey]) {
    sessions[sessionKey] = {};
  }
  return sessions[sessionKey];
}

function clearSession(sessionKey) {
  delete sessions[sessionKey];
}

module.exports = {
  getSession,
  clearSession
};
