const { Rcon } = require('rcon-client');
const db = require('../db');

const runCommand = async (guildId, command) => {
    const conf = db.getConf(guildId);

    if (!conf || !conf.rcon_host || !conf.rcon_pass) {
        return { success: false, data: 'RCON не настроен. Используйте /settings' };
    }

    let host = String(conf.rcon_host).trim();
    let port = parseInt(conf.rcon_port, 10) || 25575;

    // Handle "ip:port" entered in host field
    if (host.includes(':') && !host.startsWith('[')) {
        const parts = host.split(':');
        host = parts[0].trim();
        if (parts[1] && !isNaN(parseInt(parts[1], 10))) {
            port = parseInt(parts[1], 10);
        }
    }

    if (host.toLowerCase() === 'localhost') host = '127.0.0.1';

    const rcon = new Rcon({
        host: host,
        port: port,
        password: String(conf.rcon_pass).trim(),
        timeout: 5000
    });

    try {
        await rcon.connect();
        const response = await rcon.send(command);
        await rcon.end();
        
        return { success: true, data: response || 'Команда выполнена' };
        
    } catch (error) {
        try {
            await rcon.end().catch(() => {});
        } catch (_) {}
        return { success: false, data: `Ошибка RCON: ${error.message}` };
    }
};

module.exports = { runCommand };