const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { runCommand } = require('../utils/rcon');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('Объявление всем игрокам')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('text').setDescription('Текст').setRequired(true))
        .addStringOption(o => o.setName('mode').setDescription('Где показать').addChoices(
            { name: 'Чат', value: 'chat' },
            { name: 'Экран (Title)', value: 'title' }
        )),
    async execute(interaction) {
        const text = interaction.options.getString('text');
        const mode = interaction.options.getString('mode') || 'chat';
        
        let cmd = `say [Объявление] ${text}`;
        if (mode === 'title') cmd = `title @a title {"text":"${text}", "color":"gold"}`;

        await runCommand(interaction.guildId, cmd);
        await interaction.reply({ content: 'Отправлено!', flags: MessageFlags.Ephemeral });
    }
};