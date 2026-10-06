require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    AuditLogEvent,
    EmbedBuilder
} = require('discord.js');

const { createClient } = require('@supabase/supabase-js');

// ========================================
// SUPABASE
// ========================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ========================================
// CLIENT DISCORD
// ========================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ========================================
// CONFIGURAÇÕES
// ========================================

// Canal de logs do EB
const CANAL_LOGS_EB = '1555985263656828978';

// Canal de logs do Ghosts
const CANAL_LOGS_GHOSTS = '1555790203107414067';

// Bot Anti-Raid do PH
const ANTI_RAID_PH_ID = '1555803021227724961';

// Quantidade de entradas para considerar suspeita
const LIMITE_ENTRADAS = 5;

// Tempo da análise
const TEMPO_RAID = 10 * 1000;

// Usuários protegidos
const PROTEGIDOS = [
    '1257650260453625969',
    '1383780986994819144',
    '1544455972905295985',
    '1458626832520708197',
    '1466986389383155884'
];

// Guarda as entradas por servidor
const entradas = new Map();

// Evita detectar a mesma raid várias vezes
const raidsDetectadas = new Set();

// ========================================
// TESTAR SUPABASE
// ========================================

async function testarSupabase() {

    try {

        const { error } = await supabase
            .from('global_bans')
            .select('id')
            .limit(1);

        if (error) {

            console.error(
                '❌ Erro ao acessar global_bans:',
                error.message
            );

            return false;
        }

        console.log(
            '🗄️ Supabase conectado! global_bans acessível!'
        );

        return true;

    } catch (erro) {

        console.error(
            '❌ Erro no Supabase:',
            erro.message
        );

        return false;
    }
}

// ========================================
// BOT ONLINE
// ========================================

client.once('clientReady', async () => {

    console.log(
        `✅ Ghots Reconhecimento conectado como ${client.user.tag}`
    );

    console.log(
        '🕵️ Sistema de reconhecimento ativado!'
    );

    await testarSupabase();

});

// ========================================
// NOVO MEMBRO
// ========================================

client.on('guildMemberAdd', async (member) => {

    const guild = member.guild;

    if (!entradas.has(guild.id)) {
        entradas.set(guild.id, []);
    }

    const agora = Date.now();

    const recentes = entradas
        .get(guild.id)
        .filter(timestamp =>
            agora - timestamp <= TEMPO_RAID
        );

    recentes.push(agora);

    entradas.set(guild.id, recentes);

    console.log(
        `👤 Nova entrada em ${guild.name}: ` +
        `${recentes.length} nos últimos 10 segundos`
    );

    // ====================================
    // DETECTAR RAID
    // ====================================

    if (recentes.length >= LIMITE_ENTRADAS) {

        if (raidsDetectadas.has(guild.id)) {
            return;
        }

        raidsDetectadas.add(guild.id);

        await detectarRaid(
            guild,
            recentes.length
        );
    }

});

// ========================================
// DETECTAR RAID
// ========================================

async function detectarRaid(guild, quantidade) {

    console.log('');
    console.log('🚨 ===============================');
    console.log(`🚨 POSSÍVEL RAID: ${guild.name}`);
    console.log(`🚨 Entradas: ${quantidade}`);
    console.log('🚨 ===============================');
    console.log('');

    const canal = obterCanalLogs(guild);

    if (!canal) {

        console.log(
            `❌ Canal de logs não encontrado para ${guild.name}`
        );

        return;
    }

    // ====================================
    // ALERTA PARA O ANTI-RAID
    // ====================================

    const mensagemDetector =
        `[RAID-DETECTOR] 🚨 **POSSÍVEL RAID DETECTADA**\n\n` +
        `🏠 **Servidor:** ${guild.name}\n` +
        `👥 **Entradas suspeitas:** ${quantidade}\n` +
        `⏱️ **Período:** 10 segundos\n\n` +
        `🛡️ **Ação:** O sistema Anti-Raid deve ativar o LOCKDOWN.`;

    await canal.send({
        content: mensagemDetector
    }).catch(erro => {

        console.log(
            '❌ Não consegui enviar alerta:',
            erro.message
        );

    });

    // ====================================
    // EMBED
    // ====================================

    const embed = new EmbedBuilder()
        .setTitle('🚨 POSSÍVEL RAID DETECTADA')
        .setDescription(
            'O sistema identificou uma quantidade anormal de entradas.'
        )
        .addFields(
            {
                name: '🏠 Servidor',
                value: guild.name,
                inline: true
            },
            {
                name: '👥 Entradas',
                value: `${quantidade}`,
                inline: true
            },
            {
                name: '⏱️ Período',
                value: '10 segundos',
                inline: true
            },
            {
                name: '🛡️ Sistema',
                value: 'Ghots Reconhecimento',
                inline: true
            }
        )
        .setTimestamp();

    await canal.send({
        embeds: [embed]
    }).catch(() => {});

    // ====================================
    // VERIFICAR AUDIT LOG
    // ====================================

    await verificarAuditLog(guild);

}

// ========================================
// ESCOLHER CANAL DE LOGS
// ========================================

function obterCanalLogs(guild) {

    if (
        guild.channels.cache.has(
            CANAL_LOGS_GHOSTS
        )
    ) {

        return guild.channels.cache.get(
            CANAL_LOGS_GHOSTS
        );

    }

    if (
        guild.channels.cache.has(
            CANAL_LOGS_EB
        )
    ) {

        return guild.channels.cache.get(
            CANAL_LOGS_EB
        );

    }

    return null;
}

// ========================================
// REGISTRAR INVASOR NO GLOBAL_BANS
// ========================================

async function registrarBanGlobal(
    executor,
    guild,
    motivo
) {

    if (!executor) {
        return;
    }

    if (PROTEGIDOS.includes(executor.id)) {

        console.log(
            `🛡️ Usuário protegido não será registrado: ${executor.tag}`
        );

        return;
    }

    try {

        const { error } = await supabase
            .from('global_bans')
            .upsert(
                {
                    discord_user_id: executor.id,
                    reason: motivo,
                    source_server_id: guild.id,
                    source_server_name: guild.name,
                    created_by: client.user.id,
                    active: true
                },
                {
                    onConflict: 'discord_user_id'
                }
            );

        if (error) {

            console.error(
                '❌ Erro ao registrar no global_bans:',
                error.message
            );

            return;
        }

        console.log('');
        console.log('🌎 ===============================');
        console.log('🌎 BAN GLOBAL REGISTRADO');
        console.log(`👤 Usuário: ${executor.tag}`);
        console.log(`🆔 ID: ${executor.id}`);
        console.log(`🏠 Servidor: ${guild.name}`);
        console.log('🌎 ===============================');
        console.log('');

    } catch (erro) {

        console.error(
            '❌ Erro ao registrar ban global:',
            erro.message
        );
    }
}

// ========================================
// VERIFICAR AUDIT LOG
// ========================================

async function verificarAuditLog(guild) {

    try {

        const logs =
            await guild.fetchAuditLogs({
                type: AuditLogEvent.BotAdd,
                limit: 20
            });

        const agora = Date.now();

        for (
            const entrada of logs.entries.values()
        ) {

            const executor = entrada.executor;
            const alvo = entrada.target;

            if (!executor) {
                continue;
            }

            // Ignorar registros antigos
            if (
                agora - entrada.createdTimestamp >
                30 * 1000
            ) {
                continue;
            }

            // ====================================
            // PROTEGIDO
            // ====================================

            if (
                PROTEGIDOS.includes(executor.id)
            ) {

                console.log(
                    `🛡️ Executor protegido ignorado: ${executor.tag}`
                );

                continue;
            }

            // ====================================
            // POSSÍVEL INVASOR
            // ====================================

            console.log('');
            console.log(
                '🚨 POSSÍVEL INVASOR IDENTIFICADO'
            );

            console.log(
                `👤 Executor: ${executor.tag}`
            );

            console.log(
                `🆔 ID: ${executor.id}`
            );

            console.log(
                `🤖 Bot adicionado: ${
                    alvo?.tag ||
                    alvo?.id ||
                    'desconhecido'
                }`
            );

            const canal =
                obterCanalLogs(guild);

            if (canal) {

                const embed =
                    new EmbedBuilder()
                        .setTitle(
                            '🚨 POSSÍVEL INVASOR IDENTIFICADO'
                        )
                        .setDescription(
                            'O sistema encontrou um possível responsável pela adição de um bot.'
                        )
                        .addFields(
                            {
                                name: '👤 Executor',
                                value:
                                    `${executor.tag}\n` +
                                    `\`${executor.id}\``
                            },
                            {
                                name: '🤖 Bot adicionado',
                                value: alvo
                                    ? `${alvo.tag || 'Bot'}\n\`${alvo.id}\``
                                    : 'Desconhecido'
                            }
                        )
                        .setTimestamp();

                await canal.send({
                    embeds: [embed]
                }).catch(() => {});
            }

            // ====================================
            // REGISTRAR NO BANCO GLOBAL
            // ====================================

            await registrarBanGlobal(
                executor,
                guild,
                `Possível responsável por raid no servidor ${guild.name}`
            );

        }

    } catch (erro) {

        console.error(
            '❌ Erro ao consultar Audit Log:',
            erro.message
        );

    }

}

// ========================================
// VERIFICAR CONFIGURAÇÕES
// ========================================

if (!process.env.TOKEN) {

    console.error(
        '❌ TOKEN não encontrado no arquivo .env'
    );

    process.exit(1);
}

if (!process.env.SUPABASE_URL) {

    console.error(
        '❌ SUPABASE_URL não encontrado no arquivo .env'
    );

    process.exit(1);
}

if (!process.env.SUPABASE_KEY) {

    console.error(
        '❌ SUPABASE_KEY não encontrado no arquivo .env'
    );

    process.exit(1);
}

// ========================================
// LOGIN
// ========================================

client.login(process.env.TOKEN);