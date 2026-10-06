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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// ========================================
// SERVIDORES MONITORADOS
// ========================================

const SERVIDORES = {

    // ====================================
    // GHOSTS 1
    // ====================================

    '1555749124286976042': {
        nome: 'Ghosts 1',
        canalLogs: '1555790203107414067',
        antiRaid: 'Ghosts Anti-Raid'
    },

    // ====================================
    // GHOSTS 2
    // ====================================

    '1481136668735049883': {
        nome: 'Ghosts 2',
        canalLogs: '1556172498536763562',
        antiRaid: 'Ghosts Anti-Raid'
    },

    // ====================================
    // EB
    // ====================================

    '1536103189651394650': {
        nome: 'Exército Brasileiro',
        canalLogs: '1556860890844889178',
        antiRaid: 'Anti-Raid do PH'
    }

};

// ========================================
// BOTS ANTI-RAID
// ========================================

const GHOSTS_ANTI_RAID_ID =
    '1555759795687133214';

const ANTI_RAID_PH_ID =
    '1555982826283999252';

// ========================================
// CONFIGURAÇÕES DA RAID
// ========================================

// Quantidade de entradas necessárias
// para considerar uma possível raid.
const LIMITE_ENTRADAS = 5;

// Janela de análise:
// 10 segundos.
const TEMPO_RAID = 10 * 1000;

// Tempo até permitir detectar outra raid
// no mesmo servidor.
const TEMPO_RESET_RAID = 60 * 1000;

// ========================================
// USUÁRIOS PROTEGIDOS
// ========================================

const PROTEGIDOS = [
    '1257650260453625969',
    '1383780986994819144',
    '1544455972905295985',
    '1458626839383155884',
    '1466986389383155884'
];

// ========================================
// ARMAZENAMENTO
// ========================================

// Guarda horários de entrada por servidor.
const entradas = new Map();

// Evita alertas duplicados.
const raidsDetectadas = new Set();

// ========================================
// PEGAR CONFIGURAÇÃO
// ========================================

function obterConfigServidor(guild) {

    if (!guild) {
        return null;
    }

    return SERVIDORES[guild.id] || null;
}

// ========================================
// PEGAR CANAL DE LOGS
// ========================================

function obterCanalLogs(guild) {

    const config =
        obterConfigServidor(guild);

    if (!config) {
        return null;
    }

    const canal =
        guild.channels.cache.get(
            config.canalLogs
        );

    if (!canal) {

        console.log(
            `❌ Canal de logs não encontrado em ${guild.name}`
        );

        return null;
    }

    return canal;
}

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

client.once(
    'ready',
    async () => {

        console.log('');
        console.log('================================');
        console.log(
            `✅ ${client.user.tag} conectado!`
        );
        console.log('================================');
        console.log('');

        console.log(
            '🕵️ Sistema de reconhecimento ativado!'
        );

        console.log('');
        console.log(
            '🏠 SERVIDORES MONITORADOS:'
        );

        for (
            const guildId of Object.keys(SERVIDORES)
        ) {

            const guild =
                client.guilds.cache.get(
                    guildId
                );

            const config =
                SERVIDORES[guildId];

            if (guild) {

                console.log(
                    `✅ ${config.nome} | ${guild.name}`
                );

                console.log(
                    `   🆔 ${guild.id}`
                );

                console.log(
                    `   📋 Logs: ${config.canalLogs}`
                );

                console.log(
                    `   🛡️ Anti-Raid: ${config.antiRaid}`
                );

            } else {

                console.log(
                    `❌ Servidor não encontrado: ${guildId}`
                );

            }

        }

        console.log('');

        console.log(
            `🛡️ Ghosts Anti-Raid: ${GHOSTS_ANTI_RAID_ID}`
        );

        console.log(
            `🛡️ Anti-Raid PH: ${ANTI_RAID_PH_ID}`
        );

        console.log('');

        await testarSupabase();

    }
);

// ========================================
// NOVO MEMBRO
// ========================================

client.on(
    'guildMemberAdd',
    async (member) => {

        try {

            const guild =
                member.guild;

            // ====================================
            // IGNORAR SERVIDORES NÃO CONFIGURADOS
            // ====================================

            if (
                !SERVIDORES[guild.id]
            ) {

                return;
            }

            // ====================================
            // USUÁRIO PROTEGIDO
            // ====================================

            if (
                PROTEGIDOS.includes(
                    member.id
                )
            ) {

                console.log(
                    `🛡️ Usuário protegido entrou: ${member.user.tag}`
                );

                return;
            }

            // ====================================
            // CRIAR LISTA DO SERVIDOR
            // ====================================

            if (
                !entradas.has(
                    guild.id
                )
            ) {

                entradas.set(
                    guild.id,
                    []
                );
            }

            const agora =
                Date.now();

            // ====================================
            // PEGAR ENTRADAS RECENTES
            // ====================================

            const recentes =
                entradas
                    .get(guild.id)
                    .filter(
                        timestamp =>
                            agora - timestamp <=
                            TEMPO_RAID
                    );

            recentes.push(
                agora
            );

            entradas.set(
                guild.id,
                recentes
            );

            console.log(
                `👤 Nova entrada em ${guild.name}: ` +
                `${recentes.length} nos últimos 10 segundos`
            );

            // ====================================
            // VERIFICAR RAID
            // ====================================

            if (
                recentes.length >=
                LIMITE_ENTRADAS
            ) {

                // Já detectou recentemente?
                if (
                    raidsDetectadas.has(
                        guild.id
                    )
                ) {

                    return;
                }

                // Marca como detectada
                raidsDetectadas.add(
                    guild.id
                );

                await detectarRaid(
                    guild,
                    recentes.length
                );

                // =================================
                // LIBERAR NOVA DETECÇÃO DEPOIS
                // =================================

                setTimeout(
                    () => {

                        raidsDetectadas.delete(
                            guild.id
                        );

                        console.log(
                            `🔄 Detector liberado novamente em ${guild.name}.`
                        );

                    },
                    TEMPO_RESET_RAID
                );

            }

        } catch (erro) {

            console.error(
                '❌ Erro ao processar entrada:',
                erro.message
            );

        }

    }
);

// ========================================
// DETECTAR RAID
// ========================================

async function detectarRaid(
    guild,
    quantidade
) {

    const config =
        obterConfigServidor(
            guild
        );

    if (!config) {
        return;
    }

    console.log('');
    console.log(
        '🚨 ==============================='
    );

    console.log(
        `🚨 POSSÍVEL RAID: ${guild.name}`
    );

    console.log(
        `🚨 Entradas: ${quantidade}`
    );

    console.log(
        `🛡️ Sistema responsável: ${config.antiRaid}`
    );

    console.log(
        '🚨 ==============================='
    );

    console.log('');

    // ====================================
    // CANAL DE LOGS
    // ====================================

    const canal =
        obterCanalLogs(
            guild
        );

    if (!canal) {

        console.log(
            `❌ Canal de logs não encontrado para ${guild.name}`
        );

        return;
    }

    // ====================================
    // ALERTA RAID DETECTOR
    // ====================================

    const mensagemDetector =
        `[RAID-DETECTOR] 🚨 **POSSÍVEL RAID DETECTADA**\n\n` +

        `🏠 **Servidor:** ${guild.name}\n` +

        `🆔 **Servidor ID:** ${guild.id}\n` +

        `👥 **Entradas suspeitas:** ${quantidade}\n` +

        `⏱️ **Período:** 10 segundos\n` +

        `🛡️ **Anti-Raid responsável:** ${config.antiRaid}\n\n` +

        `🔒 **Ação:** O sistema Anti-Raid deve ativar o LOCKDOWN.`;

    await canal.send({
        content: mensagemDetector
    }).catch(
        erro => {

            console.log(
                '❌ Não consegui enviar alerta:',
                erro.message
            );

        }
    );

    // ====================================
    // EMBED
    // ====================================

    const embed =
        new EmbedBuilder()
            .setTitle(
                '🚨 POSSÍVEL RAID DETECTADA'
            )
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
                    name: '🆔 ID',
                    value: guild.id,
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
                    name: '🛡️ Anti-Raid',
                    value: config.antiRaid,
                    inline: true
                },

                {
                    name: '🕵️ Sistema',
                    value: 'Ghosts Reconhecimento',
                    inline: true
                }

            )
            .setTimestamp();

    await canal.send({
        embeds: [
            embed
        ]
    }).catch(
        () => {}
    );

    // ====================================
    // AUDIT LOG
    // ====================================

    await verificarAuditLog(
        guild
    );

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

    if (
        PROTEGIDOS.includes(
            executor.id
        )
    ) {

        console.log(
            `🛡️ Usuário protegido não será registrado: ${executor.tag}`
        );

        return;
    }

    try {

        const {
            error
        } = await supabase
            .from('global_bans')
            .upsert(
                {
                    discord_user_id:
                        executor.id,

                    reason:
                        motivo,

                    source_server_id:
                        guild.id,

                    source_server_name:
                        guild.name,

                    created_by:
                        client.user.id,

                    active:
                        true
                },
                {
                    onConflict:
                        'discord_user_id'
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
        console.log(
            '🌎 ==============================='
        );

        console.log(
            '🌎 BAN GLOBAL REGISTRADO'
        );

        console.log(
            `👤 Usuário: ${executor.tag}`
        );

        console.log(
            `🆔 ID: ${executor.id}`
        );

        console.log(
            `🏠 Servidor: ${guild.name}`
        );

        console.log(
            '🌎 ==============================='
        );

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

async function verificarAuditLog(
    guild
) {

    try {

        const logs =
            await guild.fetchAuditLogs({
                type:
                    AuditLogEvent.BotAdd,
                limit:
                    20
            });

        const agora =
            Date.now();

        for (
            const entrada
            of logs.entries.values()
        ) {

            const executor =
                entrada.executor;

            const alvo =
                entrada.target;

            if (!executor) {
                continue;
            }

            // =================================
            // IGNORAR LOG ANTIGO
            // =================================

            if (
                agora -
                entrada.createdTimestamp >
                30 * 1000
            ) {

                continue;
            }

            // =================================
            // PROTEGIDO
            // =================================

            if (
                PROTEGIDOS.includes(
                    executor.id
                )
            ) {

                console.log(
                    `🛡️ Executor protegido ignorado: ${executor.tag}`
                );

                continue;
            }

            // =================================
            // INVASOR
            // =================================

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

            // =================================
            // CANAL DE LOGS
            // =================================

            const canal =
                obterCanalLogs(
                    guild
                );

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
                                name:
                                    '👤 Executor',

                                value:
                                    `${executor.tag}\n` +
                                    `\`${executor.id}\``
                            },

                            {
                                name:
                                    '🤖 Bot adicionado',

                                value:
                                    alvo
                                        ? `${alvo.tag || 'Bot'}\n\`${alvo.id}\``
                                        : 'Desconhecido'
                            },

                            {
                                name:
                                    '🏠 Servidor',

                                value:
                                    guild.name
                            }

                        )
                        .setTimestamp();

                await canal.send({
                    embeds: [
                        embed
                    ]
                }).catch(
                    () => {}
                );

            }

            // =================================
            // REGISTRAR GLOBALMENTE
            // =================================

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

client.login(
    process.env.TOKEN
);
