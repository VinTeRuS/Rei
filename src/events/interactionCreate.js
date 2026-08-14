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
        try {
            if (interaction.isChatInputCommand()) {
                const cmd = interaction.client.commands.get(interaction.commandName);
                if (cmd) await cmd.execute(interaction).catch(console.error);
                return;
            }

            if (!interaction.guild) return;
            const guildId = interaction.guild.id;

            if (interaction.isButton() && interaction.customId === 'start_app') {
                const questions = db.getQuestions(guildId);
                if (!questions || !questions.length) {
                    return interaction.reply({ content: 'Анкеты не настроены администратором.', flags: MessageFlags.Ephemeral });
                }

                const modal = new ModalBuilder().setCustomId('submit_app').setTitle('Анкета на сервер');
                questions.forEach((q, i) => {
                    const label = (q.text && q.text.trim()) ? q.text.trim().substring(0, 45) : `Вопрос #${i + 1}`;
                    modal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId(`q_${i}`)
                            .setLabel(label)
                            .setStyle(q.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
                            .setRequired(true)
                    ));
                });
                await interaction.showModal(modal);
                return;
            }

            if (interaction.isModalSubmit() && interaction.customId === 'submit_app') {
                const conf = db.getConf(guildId);
                if (!conf.request_channel) {
                    return interaction.reply({ content: 'Канал для заявок не настроен!', flags: MessageFlags.Ephemeral });
                }

                const questions = db.getQuestions(guildId) || [];
                const answers = [];
                questions.forEach((q, i) => {
                    let answer = '';
                    try {
                        answer = interaction.fields.getTextInputValue(`q_${i}`);
                    } catch {
                        answer = '';
                    }
                    const cleanAnswer = (answer && answer.trim()) ? answer.trim() : '—';
                    const questionText = (q.text && q.text.trim()) ? q.text.trim() : `Вопрос #${i + 1}`;
                    answers.push({ 
                        q: questionText.substring(0, 256), 
                        a: cleanAnswer.substring(0, 1024) 
                    });
                });

                const rawNick = answers.length > 0 ? answers[0].a : 'Unknown'; 
                const nickname = (rawNick && rawNick !== '—') ? rawNick.split(/\s+/)[0] : (interaction.user.username || 'Unknown'); 

                const embed = new EmbedBuilder()
                    .setTitle(`ЗАЯВКА: ${nickname}`)
                    .setDescription(`ОТ: <@${interaction.user.id}>\nСТАТУС: ОЖИДАНИЕ`)
                    .setColor('#FEE75C')
                    .setFooter({ text: `User ID: ${interaction.user.id}` })
                    .setTimestamp();

                if (answers.length > 0) {
                    answers.forEach(item => embed.addFields({ 
                        name: item.q || 'Вопрос', 
                        value: item.a || '—' 
                    }));
                } else {
                    embed.addFields({ name: 'Инфо', value: 'Ответы не предоставлены' });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`appr_${nickname}_${interaction.user.id}`).setLabel('ПРИНЯТЬ').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`rejc_${interaction.user.id}`).setLabel('ОТКЛОНИТЬ').setStyle(ButtonStyle.Danger)
                );

                const channel = interaction.guild.channels.cache.get(conf.request_channel);
                if (channel) {
                    await channel.send({ embeds: [embed], components: [row] });
                    await interaction.reply({ content: 'Ваша заявка отправлена!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: 'Канал для заявок не найден! Проверьте настройки бота.', flags: MessageFlags.Ephemeral });
                }
                return;
            }

            if (interaction.isButton() && (interaction.customId.startsWith('appr_') || interaction.customId.startsWith('rejc_'))) {
                const conf = db.getConf(guildId);
                
                if (conf.admin_role && !interaction.member.roles.cache.has(conf.admin_role)) {
                    return interaction.reply({ content: 'У вас нет прав.', flags: MessageFlags.Ephemeral });
                }

                if (interaction.customId.startsWith('appr_')) {
                    const parts = interaction.customId.split('_');
                    const nickname = parts[1] || 'Unknown';
                    const userId = parts[2] || interaction.user.id;

                    await interaction.deferUpdate();

                    const result = await runCommand(guildId, `whitelist add ${nickname}`);
                    const originalEmbed = interaction.message.embeds[0];

                    if (result.success) {
                        const consoleOutput = (result.data && String(result.data).trim()) ? String(result.data).trim() : 'OK';
                        const newEmbed = (originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder())
                            .setColor('#57F287')
                            .setDescription(`ИГРОК: <@${userId}>\nСТАТУС: ОДОБРЕНО (ОНЛАЙН)\nАДМИН: <@${interaction.user.id}>`)
                            .addFields(
                                { name: 'Состояние', value: 'Игрок успешно добавлен', inline: true },
                                { name: 'Консоль', value: `\`\`\`${consoleOutput.substring(0, 1000)}\`\`\``, inline: false }
                            );
                        
                        await interaction.editReply({ embeds: [newEmbed], components: [] });

                        const user = await interaction.client.users.fetch(userId).catch(() => null);
                        if (user) user.send(`Ваша заявка одобрена! Вы добавлены в WhiteList. Приятной игры.`).catch(() => {});

                    } else {
                        db.addToQueue(guildId, nickname, userId, interaction.channelId, interaction.message.id);

                        const newEmbed = (originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder())
                            .setColor('#E67E22')
                            .setDescription(`ИГРОК: <@${userId}>\nСТАТУС: В ОЧЕРЕДИ (СЕРВЕР ОФФЛАЙН)\nАДМИН: <@${interaction.user.id}>`)
                            .addFields(
                                { name: 'Внимание', value: 'Сервер сейчас недоступен. Бот добавил игрока в авто-очередь.' },
                                { name: 'Что делать?', value: 'Ничего. Как только сервер включится, бот сам добавит игрока и обновит это сообщение на зеленое.' }
                            );

                        await interaction.editReply({ embeds: [newEmbed], components: [] });
                    }
                    return;
                }

                if (interaction.customId.startsWith('rejc_')) {
                    const userId = interaction.customId.split('_')[1];
                    const modal = new ModalBuilder().setCustomId(`m_deny_${userId}`).setTitle('Причина отказа');
                    modal.addComponents(new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('reason').setLabel('Укажите причину').setStyle(TextInputStyle.Paragraph).setRequired(true)
                    ));
                    await interaction.showModal(modal);
                    return;
                }
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('m_deny_')) {
                const userId = interaction.customId.split('_')[2];
                let reason = '';
                try {
                    reason = interaction.fields.getTextInputValue('reason');
                } catch {
                    reason = '';
                }
                const cleanReason = (reason && reason.trim()) ? reason.trim() : 'Не указана';

                const originalEmbed = interaction.message?.embeds[0];
                const newEmbed = (originalEmbed ? EmbedBuilder.from(originalEmbed) : new EmbedBuilder())
                    .setColor('#ED4245')
                    .setDescription(`ИГРОК: <@${userId}>\nСТАТУС: ОТКЛОНЕНО\nАДМИН: <@${interaction.user.id}>`)
                    .addFields({ name: 'ПРИЧИНА', value: cleanReason.substring(0, 1024) });

                await interaction.update({ embeds: [newEmbed], components: [] });

                const user = await interaction.client.users.fetch(userId).catch(() => null);
                if (user) user.send(`Ваша заявка отклонена.\nПричина: ${cleanReason}`).catch(() => {});
            }
        } catch (error) {
            console.error('Ошибка обработки взаимодействия:', error);
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Произошла непредвиденная ошибка при обработке команды/действия.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
};