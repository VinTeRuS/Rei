const Database = require('better-sqlite3');
const db = new Database('bot.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT PRIMARY KEY,
    rcon_host TEXT, rcon_port INTEGER, rcon_pass TEXT,
    admin_role TEXT, request_channel TEXT
  );
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, text TEXT, style TEXT DEFAULT 'Short'
  );
  CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    nickname TEXT,
    user_id TEXT,
    channel_id TEXT,
    message_id TEXT
  );
`);

module.exports = {
    getConf: (id) => db.prepare('SELECT * FROM settings WHERE guild_id = ?').get(id) || {},
    setConf: (id, key, val) => {
        db.prepare('INSERT OR IGNORE INTO settings (guild_id) VALUES (?)').run(id);
        db.prepare(`UPDATE settings SET ${key} = ? WHERE guild_id = ?`).run(val, id);
    },
    
    getQuestions: (id) => db.prepare('SELECT * FROM questions WHERE guild_id = ?').all(id),
    addQuestion: (id, text, style) => db.prepare('INSERT INTO questions (guild_id, text, style) VALUES (?, ?, ?)').run(id, text, style),
    deleteQuestion: (id) => db.prepare('DELETE FROM questions WHERE id = ?').run(id),
    clearQuestions: (id) => db.prepare('DELETE FROM questions WHERE guild_id = ?').run(id),

    addToQueue: (guildId, nick, userId, channelId, msgId) => 
        db.prepare('INSERT INTO queue (guild_id, nickname, user_id, channel_id, message_id) VALUES (?, ?, ?, ?, ?)').run(guildId, nick, userId, channelId, msgId),
    
    getQueue: () => db.prepare('SELECT * FROM queue').all(),
    
    removeFromQueue: (id) => db.prepare('DELETE FROM queue WHERE id = ?').run(id)
};