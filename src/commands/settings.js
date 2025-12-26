const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    StringSelectMenuBuilder,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');

const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Открыть панель управления ботом')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const guildId = interaction.guild.id;

        const generateDashboard = () => {
            const conf = db.getConf(guildId) || {};
            const questions = db.getQuestions(guildId) || [];

            const isRconOk = conf.rcon_host && conf.rcon_pass;
            const rconStatus = isRconOk ? `Активен (${conf.rcon_host})` : 'Не настроен';
            const rconPassMask = conf.rcon_pass ? '••••••••' : 'Не задан';

            const channelVal = conf.request_channel ? `<#${conf.request_channel}>` : 'Не задан';
            const roleVal = conf.admin_role ? `<@&${conf.admin_role}>` : 'Не задана';
            
            const questionsList = questions.length > 0 
                ? questions.map((q, i) => `**${i+1}.** ${q.text} \`[${q.style === 'Short' ? 'Кр.' : 'Дл.'}]\``).join('\n') 
                : '> *Список пуст. Нажмите "Добавить вопрос"*';

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle(`Панель управления: ${interaction.guild.name}`)
                .setDescription('Настройте параметры бота, используя меню и кнопки ниже.')
                .addFields(
                    { 
                        name: 'RCON (Minecraft)', 
                        value: `> **Статус:** ${rconStatus}\n> **Порт:** \`${conf.rcon_port || 25575}\`\n> **Пароль:** \`${rconPassMask}\``, 
                        inline: false 
                    },
                    { 
                        name: 'Права и Каналы', 
                        value: `> **Канал заявок:** ${channelVal}\n> **Роль Админа:** ${roleVal}`, 
                        inline: false 
                    },
                    { 
                        name: `Анкеты (${questions.length}/5)`, 
                        value: questionsList, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'Изменения применяются мгновенно' })
                .setTimestamp();

            const components = [];

            components.push(new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_channel')
                    .setPlaceholder(conf.request_channel ? 'Канал выбран (изменить)' : 'Выберите канал для заявок')
                    .setChannelTypes(ChannelType.GuildText)
            ));

            components.push(new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_role')
                    .setPlaceholder(conf.admin_role ? 'Роль выбрана (изменить)' : 'Выберите роль админа')
            ));

            if (questions.length > 0) {
                const deleteMenu = new StringSelectMenuBuilder()
                    .setCustomId('delete_question')
                    .setPlaceholder('Выберите вопрос, чтобы удалить его');
                
                questions.forEach((q, i) => {
                    deleteMenu.addOptions({
                        label: `${i+1}. ${q.text.substring(0, 50)}`,
                        description: `Тип: ${q.style === 'Short' ? 'Короткий' : 'Длинный'}`,
                        value: String(q.id)
                    });
                });
                
                components.push(new ActionRowBuilder().addComponents(deleteMenu));
            }

            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_rcon').setLabel('Настроить RCON').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('btn_add_q').setLabel('Добавить вопрос').setStyle(ButtonStyle.Primary).setDisabled(questions.length >= 5),
                new ButtonBuilder().setCustomId('btn_refresh').setLabel('Обновить').setStyle(ButtonStyle.Secondary)
            ));

            return { embeds: [embed], components: components };
        };

        const msg = await interaction.reply({ 
            ...generateDashboard(), 
            flags: MessageFlags.Ephemeral 
        });

        const collector = msg.createMessageComponentCollector({ time: 900_000 });

        collector.on('collect', async i => {
            try {
                if (i.customId === 'select_channel') { db.setConf(guildId, 'request_channel', i.values[0]); await i.update(generateDashboard()); }
                if (i.customId === 'select_role') { db.setConf(guildId, 'admin_role', i.values[0]); await i.update(generateDashboard()); }
                if (i.customId === 'btn_refresh') { await i.update(generateDashboard()); }

                if (i.customId === 'delete_question') {
                    const questionId = i.values[0];
                    db.deleteQuestion(questionId);
                    await i.update(generateDashboard());
                }

                if (i.customId === 'btn_rcon') {
                    const modal = new ModalBuilder().setCustomId('modal_rcon').setTitle('Настройка подключения');
                    const conf = db.getConf(guildId) || {};
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('host').setLabel('IP Адрес').setValue(conf.rcon_host || '').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('port').setLabel('Порт').setValue(String(conf.rcon_port || 25575)).setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pass').setLabel('Пароль').setValue(conf.rcon_pass || '').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    await i.showModal(modal);
                    
                    const s = await i.awaitModalSubmit({ time: 60000, filter: (s) => s.user.id === i.user.id }).catch(() => null);
                    if (s) {
                        const port = parseInt(s.fields.getTextInputValue('port'));
                        if (isNaN(port)) return s.reply({content:'Порт должен быть числом!', flags: MessageFlags.Ephemeral});
                        db.setConf(guildId, 'rcon_host', s.fields.getTextInputValue('host'));
                        db.setConf(guildId, 'rcon_port', port);
                        db.setConf(guildId, 'rcon_pass', s.fields.getTextInputValue('pass'));
                        await s.update(generateDashboard());
                    }
                }

                if (i.customId === 'btn_add_q') {
                    const modal = new ModalBuilder().setCustomId('modal_add_q').setTitle('Новый вопрос');
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('txt').setLabel('Текст вопроса').setPlaceholder('Ваш ник?').setStyle(TextInputStyle.Short).setRequired(true)),
                        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('style').setLabel('Тип (Короткий/Длинный)').setValue('Короткий').setStyle(TextInputStyle.Short).setRequired(true))
                    );
                    await i.showModal(modal);

                    const s = await i.awaitModalSubmit({ time: 60000, filter: (s) => s.user.id === i.user.id }).catch(() => null);
                    if (s) {
                        const rawStyle = s.fields.getTextInputValue('style').toLowerCase();
                        const style = (rawStyle.includes('длин') || rawStyle.includes('long')) ? 'Paragraph' : 'Short';
                        db.addQuestion(guildId, s.fields.getTextInputValue('txt'), style);
                        await s.update(generateDashboard());
                    }
                }

            } catch (err) {
                console.error(err);
                if (!i.replied && !i.deferred) await i.reply({ content: 'Ошибка взаимодействия.', flags: MessageFlags.Ephemeral });
            }
        });
    }
};