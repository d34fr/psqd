import fs from 'fs';
import path from 'path';
import { EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

export const DATA_PATH = path.join(path.resolve(), 'permissions.json');
export const CONFIG_PATH = path.join(path.resolve(), 'config.json');

export function loadJsonSafe(file, fallback) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function safeWriteJson(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export function isValidSnowflake(id) {
  return typeof id === 'string' && /^[0-9]{16,22}$/.test(id);
}

export function codeEmoji(text) {
  return `\`${text}\``;
}
export function fmtLine(emoji, text) {
  return `${codeEmoji(emoji)}〃${text}`;
}

export function baseEmbed() {
  return new EmbedBuilder()
    .setColor(0x000000)
    .setFooter({ text: 'Gestion VC ©' })
    .setTimestamp();
}

export function userToId(arg) {
  if (!arg) return null;
  const mention = arg.match(/^<@!?(\d{16,22})>$/);
  if (mention) return mention[1];
  if (isValidSnowflake(arg)) return arg;
  return null;
}

export function channelToId(arg) {
  if (!arg) return null;
  const mention = arg.match(/^<#(\d{16,22})>$/);
  if (mention) return mention[1];
  if (isValidSnowflake(arg)) return arg;
  return null;
}

export function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

export function getAllGuildVoiceChannels(guild) {
  return guild.channels.cache.filter(ch =>
    ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice
  );
}

export function canBotMoveInGuild(guild, me) {
  if (!me) return false;
  const perms = me.permissions;
  return perms.has(PermissionFlagsBits.MoveMembers) && perms.has(PermissionFlagsBits.Connect) && perms.has(PermissionFlagsBits.ViewChannel);
}

export function sortChannelsByCategoryThenName(channels) {
  return [...channels.values()].sort((a, b) => {
    const ca = a.parent?.name || '';
    const cb = b.parent?.name || '';
    if (ca === cb) return a.name.localeCompare(b.name);
    return ca.localeCompare(cb);
  });
}

// Simple lock per userId to serialize move operations.
const userLocks = new Map();
export async function withUserLock(userId, fn) {
  const prev = userLocks.get(userId) || Promise.resolve();
  let release;
  const p = new Promise(async (resolve) => {
    release = resolve;
    try { await prev; } catch {}
    try { await fn(); } finally { resolve(); }
  });
  userLocks.set(userId, p);
  await p;
  release();
}

// Logging helper
export async function logAction(client, data, guild, content) {
  try {
    if (!data.logChannelId) return;
    const ch = guild.channels.cache.get(data.logChannelId);
    if (!ch) return;
    const emb = baseEmbed()
      .setTitle('\`📄\` ▸ Nouvel Logs')
      .setDescription(content);
    await ch.send({ embeds: [emb] });
  } catch {}
}
