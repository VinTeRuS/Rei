const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { runCommand } = require('../utils/rcon');

module.exports = {
    data: new SlashCommandBuilder().setName('status').setDescription('Узнать статус сервера и онлайн'),
    async execute(interaction) {
        await interaction.deferReply();
        const response = await runCommand('list');
        
        const isOnline = !response.includes('Ошибка');
        
        const embed = new EmbedBuilder()
            .setTitle('Статус сервера')
            .setColor(isOnline ? 'Green' : 'Red')
            .addFields(
                { name: 'Состояние', value: isOnline ? 'Работает' : 'Выключен' },
                { name: 'Ответ сервера', value: `\`${response}\`` }
            );

        await interaction.editReply({ embeds: [embed] });
    }
};