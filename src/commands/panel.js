import { baseEmbed } from '../utils.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export async function panel(client, message, args, data) {
  try {
    const guild = message.guild;
    if (!guild) return;

    // Vérification des permissions
    const isSysPlus = data['sys+']?.includes(message.author.id);
    const isSys = data.sys?.includes(message.author.id);
    const isOwner = data.owner?.includes(message.author.id);

    if (!isSysPlus && !isSys && !isOwner) {
      const embed = baseEmbed()
        .setTitle('❌ Accès refusé')
        .setDescription('Tu n\'as pas les permissions pour utiliser cette commande.');
      return message.reply({ embeds: [embed] });
    }

    // Fonction helper pour vérifier si une valeur est "on"
    const isOn = (v) => {
      if (v === true) return true;
      if (typeof v === 'number') return v === 1;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === 'true' || s === 'on' || s === '1' || s === 'oui';
      }
      return false;
    };

    const toInt = (v, def) => {
      const n = parseInt(String(v ?? '').trim(), 10);
      return Number.isFinite(n) && n > 0 ? n : def;
    };

    // S'assurer que les données de protection existent
    if (!data.protect) data.protect = {};
    const p = data.protect;
    if (!p.enabled) p.enabled = { MUTE: "false", DECO: "false", MOVE: "false" };
    if (!p.window) p.window = { MUTE: "30", DECO: "30", MOVE: "30" };
    if (!p.limit) p.limit = { MUTE: "3", DECO: "3", MOVE: "3" };

    const lines = [
      `**DECO** — état: **${isOn(p.enabled.DECO) ? 'on' : 'off'}**, fenêtre: **${toInt(p.window.DECO,30)}** min, limite: **${toInt(p.limit.DECO,3)}**`,
      `**MUTE** — état: **${isOn(p.enabled.MUTE) ? 'on' : 'off'}**, fenêtre: **${toInt(p.window.MUTE,30)}** min, limite: **${toInt(p.limit.MUTE,3)}**`,
      `**MOVE** — état: **${isOn(p.enabled.MOVE) ? 'on' : 'off'}**, fenêtre: **${toInt(p.window.MOVE,30)}** min, limite: **${toInt(p.limit.MOVE,3)}**`
    ].join('\n');

    const embed = baseEmbed()
      .setTitle('🛡️ Protection vocale')
      .setDescription(lines)
      .setColor(0x000000);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_cfg_DECO')
        .setLabel('Config DECO')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_cfg_MUTE')
        .setLabel('Config MUTE')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel_cfg_MOVE')
        .setLabel('Config MOVE')
        .setStyle(ButtonStyle.Primary)
    );

    await message.reply({ embeds: [embed], components: [row1] });

  } catch (error) {
    console.error('Erreur panel:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}