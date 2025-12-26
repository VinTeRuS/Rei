const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Создать кнопку для подачи заявки')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('Заявка на Whitelist')
            .setDescription('Чтобы попасть на сервер, необходимо пройти проверку.\nНажмите кнопку ниже, чтобы открыть анкету.')
            .setColor('#2b2d31')
            .setThumbnail(interaction.guild.iconURL());

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_app')
                .setLabel('Подать заявку')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Панель заявок создана.', flags: MessageFlags.Ephemeral });
    }
};