import chalk from 'chalk';
import {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType,
  AuditLogEvent,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { loadJsonSafe, safeWriteJson, DATA_PATH, CONFIG_PATH, baseEmbed, fmtLine, logAction } from './utils.js';
import { handleCommand } from './commands.js';
import { attachVoiceGuards } from './voiceLogic.js';

/* -------------------- helpers -------------------- */
const isOn = (v) => {
  if (v === true) return true;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 'on' || s === '1' || s === 'oui';
  }
  return false;
};
const toStrBool = (b) => (b ? 'true' : 'false');
const toInt = (v, def) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* -------------------- load config/data -------------------- */
const config = loadJsonSafe(CONFIG_PATH, {});
const data = loadJsonSafe(DATA_PATH, {
  "sys+": [], "sys": [], "owner": [], "wl": [],
  "setupRoles": { "find": [], "mv": [], "join": [], "all": [] },
  "pv": { "enabledChannels": [], "owners": {}, "access": {} },
  "catlock": { "categories": [] },
  "logChannelId": "",
  "prefix": "=",
});

function persist() {
  try { safeWriteJson(DATA_PATH, data); } catch (e) { console.error('Persist error', e); }
}

/* -------------------- defaults -------------------- */
function ensureProtectDefaults() {
  if (!data.protect) data.protect = {};
  const p = data.protect;
  p.enabled = p.enabled || { MUTE: "false", DECO: "false", MOVE: "false" };
  p.window  = p.window  || { MUTE: "30",    DECO: "30",    MOVE: "30" };
  p.limit   = p.limit   || { MUTE: "3",     DECO: "3",     MOVE: "3"  };
  p.valid   = p.valid   || { MUTE: [],      DECO: [],      MOVE: []   };
  if (!Array.isArray(p.valid.MUTE)) p.valid.MUTE = [];
  if (!Array.isArray(p.valid.DECO)) p.valid.DECO = [];
  if (!Array.isArray(p.valid.MOVE)) p.valid.MOVE = [];
  if (!data.follow) data.follow = {};
  if (!data.laisse) data.laisse = {};
}
ensureProtectDefaults();

/* -------------------- client -------------------- */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember, Partials.User]
});

client.once('ready', () => {
  console.log(chalk.green(`[READY] Connecté en tant que ${client.user.tag}`));
  // Retire toute activité → plus de “Joue à …”
  client.user.setPresence({ activities: [], status: 'online' });
});

/* -------------------- commands -------------------- */
client.on('messageCreate', async (message) => {
  try {
    if (!message.guild || message.author.bot) return;
    const prefix = data.prefix || '=';
    if (!message.content.startsWith(prefix)) return;
    await handleCommand(client, message, data, prefix);
  } catch (e) { console.error(e); }
});

/* -------------------- panel interactions -------------------- */
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;
    ensureProtectDefaults();

    if (interaction.isButton() && interaction.customId.startsWith('panel_cfg_')) {
      const action = interaction.customId.split('panel_cfg_')[1]; // DECO/MUTE/MOVE
      const p = data.protect;

      const modal = new ModalBuilder()
        .setCustomId(`panel_modal_${action}_${interaction.message.id}`)
        .setTitle(`Configurer ${action}`);

      const enabled = new TextInputBuilder()
        .setCustomId('enabled')
        .setLabel('Activer ? (on/off)')
        .setStyle(TextInputStyle.Short)
        .setValue(isOn(p.enabled[action]) ? 'on' : 'off');

      const windowMinutes = new TextInputBuilder()
        .setCustomId('window')
        .setLabel('Fenêtre (minutes)')
        .setStyle(TextInputStyle.Short)
        .setValue(String(toInt(p.window[action], 30)));

      const limit = new TextInputBuilder()
        .setCustomId('limit')
        .setLabel('Limite (actions)')
        .setStyle(TextInputStyle.Short)
        .setValue(String(toInt(p.limit[action], 3)));

      modal.addComponents(
        new ActionRowBuilder().addComponents(enabled),
        new ActionRowBuilder().addComponents(windowMinutes),
        new ActionRowBuilder().addComponents(limit)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('panel_modal_')) {
      const parts = interaction.customId.split('_');
      const ACTION = parts[2];
      const originMsgId = parts[3];

      const enabledStr = interaction.fields.getTextInputValue('enabled') ?? '';
      const enabled = isOn(enabledStr);
      const windowM = toInt(interaction.fields.getTextInputValue('window'), 30);
      const limit = toInt(interaction.fields.getTextInputValue('limit'), 3);

      data.protect.enabled[ACTION] = toStrBool(enabled);
      data.protect.window[ACTION] = String(windowM);
      data.protect.limit[ACTION] = String(limit);
      persist();

      try {
        const msg = await interaction.channel.messages.fetch(originMsgId);
        const p = data.protect;
        const lines = [
          `**DECO** — état: **${isOn(p.enabled.DECO) ? 'on' : 'off'}**, fenêtre: **${toInt(p.window.DECO,30)}** min, limite: **${toInt(p.limit.DECO,3)}**`,
          `**MUTE** — état: **${isOn(p.enabled.MUTE) ? 'on' : 'off'}**, fenêtre: **${toInt(p.window.MUTE,30)}** min, limite: **${toInt(p.limit.MUTE,3)}**`,
          `**MOVE** — état: **${isOn(p.enabled.MOVE) ? 'on' : 'off'}**, fenêtre: **${toInt(p.window.MOVE,30)}** min, limite: **${toInt(p.limit.MOVE,3)}**`
        ].join('\n');
        const embed = baseEmbed().setTitle('🛡️ Protection vocale').setDescription(lines).setColor(0x000000);
        await msg.edit({ embeds: [embed] });
      } catch {}

      await interaction.reply({ content: `Config ${ACTION} mise à jour ✅`, ephemeral: true });
      return;
    }
  } catch (e) {
    console.error('interactionCreate error', e);
  }
});

/* -------------------- anti-abus + follow/laisse -------------------- */
const hitStore = new Map();        // clé: `${guildId}:${executorId}:${type}` -> [timestamps] (comptage sanctionnable)
const hitStoreLogOnly = new Map(); // idem (exempts) pour affichage x/∞
const AUDIT_MATCH_WINDOW_MS = 45000;
const AGG_GRACE_MS = 5000;         // fenêtre d'acceptation après hausse de count

function pushHit(store, guildId, executorId, type, windowMs) {
  const key = `${guildId}:${executorId}:${type}`;
  const now = Date.now();
  const arr = store.get(key) || [];
  const cutoff = now - windowMs;
  const filtered = arr.filter(ts => ts >= cutoff);
  filtered.push(now);
  store.set(key, filtered);
  return filtered.length;
}

async function derankMember(guild, executorId) {
  try {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return false;
    const me = guild.members.me;
    if (!me) return false;

    const manageable = member.roles.cache.filter(r => r.editable && r.id !== guild.roles.everyone.id);
    await member.roles.remove([...manageable.keys()], 'Anti-abus vocal: limite franchie');
    return true;
  } catch (e) { console.error('derankMember error', e); return false; }
}

/* --- suivi des entrées d’audit agrégées (MemberDisconnect/MemberMove) --- */
const aggTrack = {
  DECO: new Map(), // key `${guildId}:${entryId}` -> { count, lastBumpAt }
  MOVE: new Map(),
};
function acceptAggregatedEntry(guildId, type, entry, nowTs) {
  const store = aggTrack[type];
  const key = `${guildId}:${entry.id}`;
  const prev = store.get(key);
  const count = entry?.extra?.count ?? null;

  const withinTime = Math.abs(nowTs - entry.createdTimestamp) <= AUDIT_MATCH_WINDOW_MS;
  if (withinTime) {
    if (count != null && (!prev || count > prev.count)) store.set(key, { count, lastBumpAt: nowTs });
    return true;
  }

  if (count == null) return false;

  if (!prev) {
    store.set(key, { count, lastBumpAt: nowTs });
    return true;
  }

  if (count > prev.count) {
    store.set(key, { count, lastBumpAt: nowTs });
    return true;
  }

  if (nowTs - prev.lastBumpAt <= AGG_GRACE_MS) return true;

  return false;
}

client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    ensureProtectDefaults();

    /* ---- follow / laisse (expiration + moves auto) ---- */
    const now = Date.now();
    for (const [execId, entry] of Object.entries(data.follow || {})) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        try { const u = await client.users.fetch(execId); await u.send('⌛ Ton follow a expiré (30 min).'); } catch {}
        delete data.follow[execId]; persist();
      }
    }
    for (const [targetId, entry] of Object.entries(data.laisse || {})) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        try { const u = await client.users.fetch(targetId); await u.send('⌛ La laisse a expiré (30 min).'); } catch {}
        delete data.laisse[targetId]; persist();
      }
    }

    const moved = oldState.channelId !== newState.channelId;
    if (moved) {
      const targetId = newState.id;
      for (const [execId, entry] of Object.entries(data.follow || {})) {
        if (entry.targetId === targetId && entry.expiresAt > now) {
          const execMember = await guild.members.fetch(execId).catch(() => null);
          const dest = newState.channel;
          if (execMember && dest && execMember.voice?.channelId !== dest.id) {
            await execMember.voice.setChannel(dest, 'Follow auto').catch(() => {});
          }
        }
      }
      const ownerId = newState.id;
      for (const [tId, entry] of Object.entries(data.laisse || {})) {
        if (entry.ownerId === ownerId && entry.expiresAt > now) {
          const targetMember = await guild.members.fetch(tId).catch(() => null);
          const dest = newState.channel;
          if (targetMember && dest && targetMember.voice?.channelId !== dest.id) {
            await targetMember.voice.setChannel(dest, 'Laisse auto').catch(() => {});
          }
        }
      }
    }

    /* ---- anti-abus ---- */
    const member = newState.member || oldState.member;
    if (!member) return;

    const p = data.protect;
    const nowTs = Date.now();

    async function findAuditWithRetries(fetcher) {
      let res = await fetcher();
      if (res) return res;
      await sleep(900);
      res = await fetcher();
      if (res) return res;
      await sleep(1500);
      return await fetcher();
    }

    // MOVE (agrégé)
    async function findMoveEntry() {
      if (!oldState.channelId || !newState.channelId || oldState.channelId === newState.channelId) return null;
      const fetcher = async () => {
        try {
          const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberMove, limit: 5 });
          const entry = logs?.entries?.find(e =>
            e.executor && e.executor.id !== member.id &&
            (e.extra?.channel?.id ? (e.extra.channel.id === oldState.channelId || e.extra.channel.id === newState.channelId) : true) &&
            acceptAggregatedEntry(guild.id, 'MOVE', e, nowTs)
          );
          if (!entry) return null;
          return { executorId: entry.executor.id, type: 'MOVE', channelId: newState.channelId };
        } catch { return null; }
      };
      return await findAuditWithRetries(fetcher);
    }

    // DECO (agrégé)
    async function findDecoEntry() {
      if (!(oldState.channelId && !newState.channelId)) return null;
      const fetcher = async () => {
        try {
          const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberDisconnect, limit: 5 });
          const entry = logs?.entries?.find(e =>
            e.executor && e.executor.id !== member.id &&
            (e.extra?.channel?.id ? e.extra.channel.id === oldState.channelId : true) &&
            acceptAggregatedEntry(guild.id, 'DECO', e, nowTs)
          );
          if (!entry) return null;
          return { executorId: entry.executor.id, type: 'DECO', channelId: oldState.channelId };
        } catch { return null; }
      };
      return await findAuditWithRetries(fetcher);
    }

    // MUTE (non agrégé)
    async function findMuteEntry() {
      const muteChanged = (oldState.serverMute !== newState.serverMute) || (oldState.serverDeaf !== newState.serverDeaf);
      if (!muteChanged) return null;
      const fetcher = async () => {
        try {
          const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 });
          const entry = logs?.entries?.find(e =>
            Math.abs(nowTs - e.createdTimestamp) <= AUDIT_MATCH_WINDOW_MS &&
            e.executor && e.executor.id !== member.id &&
            e.target?.id === member.id &&
            (Array.isArray(e.changes) ? e.changes.some(ch => ch?.key === 'mute' || ch?.key === 'deaf') : true)
          );
          if (!entry) return null;
          return { executorId: entry.executor.id, type: 'MUTE', channelId: newState.channelId || oldState.channelId };
        } catch { return null; }
      };
      return await findAuditWithRetries(fetcher);
    }

    const events = [];
    if (isOn(p.enabled.MOVE)) events.push(await findMoveEntry());
    if (isOn(p.enabled.DECO)) events.push(await findDecoEntry());
    if (isOn(p.enabled.MUTE)) events.push(await findMuteEntry());

    for (const ev of events.filter(Boolean)) {
      const action = ev.type;
      const windowMin = toInt(p.window[action], 30);
      const limit = toInt(p.limit[action], 3);
      const executorId = ev.executorId;

      /* 🔒 Ignore totalement les actions exécutées par le bot lui-même */
      if (executorId === client.user.id) {
        continue; // pas de log, pas de compteur, pas de sanction
      }

      const isSysPlus = data['sys+']?.includes(executorId);
      const isSys = data.sys?.includes(executorId);
      const isAllowlisted = Array.isArray(p.valid[action]) ? p.valid[action].includes(executorId) : false;
      const exempt = isSysPlus || isSys || isAllowlisted;

      const statusBits = [];
      if (isSysPlus) statusBits.push('SYS+');
      else if (isSys) statusBits.push('SYS');
      if (isAllowlisted) statusBits.push(`Allowlist ${action}`);
      const statusLine = statusBits.length ? fmtLine('🧾', `Statut: **${statusBits.join(' & ')}**`) : fmtLine('🧾', 'Statut: **—**');

      if (exempt) {
        const countEx = pushHit(hitStoreLogOnly, guild.id, executorId, action, windowMin * 60 * 1000);
        const line = [
          fmtLine('👤', `Exécuteur: <@${executorId}> \`${executorId}\``),
          fmtLine('🎯', `Cible: <@${member.id}> \`${member.id}\``),
          fmtLine('🏷️', `Type: **${action}**`),
          fmtLine('🧮', `Compteur ${windowMin}min = **${countEx}/∞**`),
          ev.channelId ? fmtLine('📍', `Salon: <#${ev.channelId}>`) : null,
          fmtLine('🛡️', '**[EXEMPT]** aucune sanction'),
          statusLine
        ].filter(Boolean).join('\n');
        await logAction(client, data, guild, `Action détectée\n${line}`);
        continue;
      }

      const count = pushHit(hitStore, guild.id, executorId, action, windowMin * 60 * 1000);
      const line = [
        fmtLine('👤', `Exécuteur: <@${executorId}> \`${executorId}\``),
        fmtLine('🎯', `Cible: <@${member.id}> \`${member.id}\``),
        fmtLine('🏷️', `Type: **${action}**`),
        fmtLine('🧮', `Compteur ${windowMin}min = **${count}/${limit}**`),
        ev.channelId ? fmtLine('📍', `Salon: <#${ev.channelId}>`) : null,
        statusLine
      ].filter(Boolean).join('\n');
      await logAction(client, data, guild, `Action détectée\n${line}`);

      if (count > limit) {
        const ok = await derankMember(guild, executorId);
        const msg = ok ? `⛔ Limite franchie → tous les rôles retirés pour <@${executorId}>.` : `⚠️ Limite franchie mais impossible de retirer les rôles (vérifie les permissions et la hiérarchie).`;
        await logAction(client, data, guild, msg);
      }
    }
  } catch (e) { console.error('voiceStateUpdate error', e); }
});

/* -------------------- PV & Catlock enforcement -------------------- */
attachVoiceGuards(client, data);

/* -------------------- login -------------------- */
if (!config.token || config.token === 'METTEZ_VOTRE_TOKEN_ICI') {
  console.error('❌ Merci de mettre votre token dans config.json (clé "token").');
  process.exit(1);
}
client.login(config.token);
