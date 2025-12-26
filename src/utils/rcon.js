const { Rcon } = require('rcon-client');
const db = require('../db');

const runCommand = async (guildId, command) => {
    const conf = db.getConf(guildId);

    if (!conf.rcon_host || !conf.rcon_pass) {
        return { success: false, data: 'RCON не настроен. Используйте /settings' };
    }

    const rcon = new Rcon({
        host: conf.rcon_host,
        port: conf.rcon_port || 25575,
        password: conf.rcon_pass,
        timeout: 3000
    });

    try {
        await rcon.connect();
        const response = await rcon.send(command);
        await rcon.end();
        
        return { success: true, data: response };
        
    } catch (error) {
        return { success: false, data: `Ошибка подключения: ${error.message}` };
    }
};

module.exports = { runCommand };