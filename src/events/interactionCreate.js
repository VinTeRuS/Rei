const { 
    Events, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    MessageFlags 
} = require('discord.js');
const db = require('../db');
const { runCommand } = require('../utils/rcon');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        
        if (interaction.isChatInputCommand()) {
            const cmd = interaction.client.commands.get(interaction.commandName);
            if (cmd) await cmd.execute(interaction).catch(console.error);
        }

        const guildId = interaction.guild.id;

        if (interaction.isButton() && interaction.customId === 'start_app') {
            const questions = db.getQuestions(guildId);
            if (!questions || !questions.length) {
                return interaction.reply({ content: 'Анкеты не настроены администратором.', flags: MessageFlags.Ephemeral });
            }

            const modal = new ModalBuilder().setCustomId('submit_app').setTitle('Анкета на сервер');
            questions.forEach((q, i) => {
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId(`q_${i}`).setLabel(q.text.substring(0, 45)).setStyle(q.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(true)
                ));
            });
            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'submit_app') {
            const conf = db.getConf(guildId);
            if (!conf.request_channel) {
                return interaction.reply({ content: 'Канал для заявок не настроен!', flags: MessageFlags.Ephemeral });
            }

            const questions = db.getQuestions(guildId);
            const answers = [];
            questions.forEach((q, i) => answers.push({ q: q.text, a: interaction.fields.getTextInputValue(`q_${i}`) }));

            const rawNick = answers[0].a; 
            const nickname = rawNick.trim().split(/\s+/)[0]; 

            const embed = new EmbedBuilder()
                .setTitle(`ЗАЯВКА: ${nickname}`)
                .setDescription(`ОТ: <@${interaction.user.id}>\nСТАТУС: ОЖИДАНИЕ`)
                .setColor('#FEE75C')
                .setFooter({ text: `User ID: ${interaction.user.id}` })
                .setTimestamp();

            answers.forEach(item => embed.addFields({ name: item.q, value: item.a }));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`appr_${nickname}_${interaction.user.id}`).setLabel('ПРИНЯТЬ').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`rejc_${interaction.user.id}`).setLabel('ОТКЛОНИТЬ').setStyle(ButtonStyle.Danger)
            );

            const channel = interaction.guild.channels.cache.get(conf.request_channel);
            if (channel) {
                await channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: 'Ваша заявка отправлена!', flags: MessageFlags.Ephemeral });
            }
        }

        if (interaction.isButton() && (interaction.customId.startsWith('appr_') || interaction.customId.startsWith('rejc_'))) {
            const conf = db.getConf(guildId);
            
            if (conf.admin_role && !interaction.member.roles.cache.has(conf.admin_role)) {
                return interaction.reply({ content: 'У вас нет прав.', flags: MessageFlags.Ephemeral });
            }

            if (interaction.customId.startsWith('appr_')) {
                const parts = interaction.customId.split('_');
                const nickname = parts[1];
                const userId = parts[2];

                await interaction.deferUpdate();

                const result = await runCommand(guildId, `whitelist add ${nickname}`);

                if (result.success) {
                    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#57F287')
                        .setDescription(`ИГРОК: <@${userId}>\nСТАТУС: ОДОБРЕНО (ОНЛАЙН)\nАДМИН: <@${interaction.user.id}>`)
                        .addFields(
                            { name: 'Состояние', value: 'Игрок успешно добавлен', inline: true },
                            { name: 'Консоль', value: `\`\`\`${result.data}\`\`\``, inline: false }
                        );
                    
                    await interaction.editReply({ embeds: [newEmbed], components: [] });

                    const user = await interaction.client.users.fetch(userId).catch(() => null);
                    if (user) user.send(`Ваша заявка одобрена! Вы добавлены в WhiteList. Приятной игры.`).catch(() => {});

                } else {
                    db.addToQueue(guildId, nickname, userId, interaction.channelId, interaction.message.id);

                    const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor('#E67E22')
                        .setDescription(`ИГРОК: <@${userId}>\nСТАТУС: В ОЧЕРЕДИ (СЕРВЕР ОФФЛАЙН)\nАДМИН: <@${interaction.user.id}>`)
                        .addFields(
                            { name: 'Внимание', value: 'Сервер сейчас недоступен. Бот добавил игрока в авто-очередь.' },
                            { name: 'Что делать?', value: 'Ничего. Как только сервер включится, бот сам добавит игрока и обновит это сообщение на зеленое.' }
                        );

                    await interaction.editReply({ embeds: [newEmbed], components: [] });
                }
            }

            if (interaction.customId.startsWith('rejc_')) {
                const userId = interaction.customId.split('_')[1];
                const modal = new ModalBuilder().setCustomId(`m_deny_${userId}`).setTitle('Причина отказа');
                modal.addComponents(new ActionRowBuilder().addComponents(
                    new TextInputBuilder().setCustomId('reason').setLabel('Укажите причину').setStyle(TextInputStyle.Paragraph).setRequired(true)
                ));
                await interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('m_deny_')) {
            const userId = interaction.customId.split('_')[2];
            const reason = interaction.fields.getTextInputValue('reason');

            const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#ED4245')
                .setDescription(`ИГРОК: <@${userId}>\nСТАТУС: ОТКЛОНЕНО\nАДМИН: <@${interaction.user.id}>`)
                .addFields({ name: 'ПРИЧИНА', value: reason });

            await interaction.update({ embeds: [newEmbed], components: [] });

            const user = await interaction.client.users.fetch(userId).catch(() => null);
            if (user) user.send(`Ваша заявка отклонена.\nПричина: ${reason}`).catch(() => {});
        }
    }
};