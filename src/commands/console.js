const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { runCommand } = require('../utils/rcon');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('console')
        .setDescription('Выполнить RCON команду')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('cmd').setDescription('Команда (без /)').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const cmd = interaction.options.getString('cmd');
        const result = await runCommand(interaction.guildId, cmd);
        const safeRes = result.data.length > 1900 ? result.data.substring(0, 1900) + '...' : result.data;
        await interaction.editReply(`> /${cmd}\n\`\`\`${safeRes}\`\`\``);
    }
};