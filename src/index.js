const { Client, GatewayIntentBits, Collection, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { runCommand } = require('./utils/rcon');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsJson = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
    commandsJson.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('Обновление команд...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commandsJson },
        );
        console.log('Команды зарегистрированы!');
    } catch (error) { console.error(error); }
})();

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) client.once(event.name, (...args) => event.execute(...args));
    else client.on(event.name, (...args) => event.execute(...args));
}

setInterval(async () => {
    const queue = db.getQueue();
    
    if (!queue || queue.length === 0) return;

    console.log(`[AutoCheck] В очереди ${queue.length} игроков. Проверяю сервер...`);

    for (const item of queue) {

        const result = await runCommand(item.guild_id, `whitelist add ${item.nickname}`);

        if (result.success) {
            console.log(`[AutoCheck] Сервер онлайн. Добавляю ${item.nickname}.`);

            db.removeFromQueue(item.id);

            try {
                const guild = await client.guilds.fetch(item.guild_id).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(item.channel_id).catch(() => null);
                if (!channel) continue;

                const message = await channel.messages.fetch(item.message_id).catch(() => null);
                
                if (message) {
                    const oldEmbed = message.embeds[0];
                    
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setColor('#57F287')
                        .setDescription(oldEmbed.description.replace('ОЖИДАНИЕ СЕРВЕРА', 'ОДОБРЕНО (АВТО)'))
                        .setFields(
                            { name: 'СТАТУС', value: 'Игрок добавлен автоматически (Сервер включился)' },
                            { name: 'КОНСОЛЬ', value: `\`\`\`${result.data}\`\`\`` }
                        );
                    
                    await message.edit({ embeds: [newEmbed] });
                }

                const user = await client.users.fetch(item.user_id).catch(() => null);
                if (user) {
                    user.send(`Сервер включился! Вы были автоматически добавлены в WhiteList (Ник: ${item.nickname}).`).catch(() => {});
                }

            } catch (err) {
                console.error(`[AutoCheck] Ошибка обновления сообщения для ${item.nickname}:`, err.message);
            }
        }
    }

}, 60 * 1000);

client.login(process.env.TOKEN);