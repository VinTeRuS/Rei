const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { runCommand } = require('../utils/rcon');

module.exports = {
    data: new SlashCommandBuilder().setName('status').setDescription('Узнать статус сервера и онлайн'),
    async execute(interaction) {
        await interaction.deferReply();
        const result = await runCommand(interaction.guildId, 'list');
        
        const isOnline = result.success;
        const responseData = (result.data && String(result.data).trim()) ? String(result.data).trim() : 'Нет ответа от сервера';
        
        const embed = new EmbedBuilder()
            .setTitle('Статус сервера')
            .setColor(isOnline ? 'Green' : 'Red')
            .addFields(
                { name: 'Состояние', value: isOnline ? 'Работает (Онлайн)' : 'Выключен / Недоступен' },
                { name: 'Ответ сервера', value: `\`\`\`${responseData.substring(0, 1000)}\`\`\`` }
            );

        await interaction.editReply({ embeds: [embed] });
    }
};