import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { baseEmbed, fmtLine, logAction } from './utils.js';

/**
 * Active les protections PV et Catlock sur les salons vocaux.
 *
 * - PV : Seul le propriétaire et les utilisateurs autorisés peuvent rester dans le salon.
 * - Catlock : Seuls les utilisateurs dans la whitelist (WL) peuvent rester.
 *
 * Si un utilisateur ne respecte pas ces règles, il est expulsé avec un message explicatif en DM.
 */
export function attachVoiceGuards(client, data) {
  client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
      const guild = newState.guild || oldState.guild;
      if (!guild) return;

      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;

      const newChannel = newState.channel;
      if (!newChannel) return; // L'utilisateur a quitté un salon, on ne fait rien.

      // ✅ Vérification PV
      if (data.pv.enabledChannels.includes(newChannel.id)) {
        const ownerId = data.pv.owners[newChannel.id];
        const allowedUsers = new Set([ownerId, ...(data.pv.access[newChannel.id] || [])]);

        if (!allowedUsers.has(member.id)) {
          await handleKickFromVoice({
            member,
            reason: 'PV: accès refusé',
            title: '🔒 Vocal PV — Accès refusé',
            description: [
              fmtLine('🙅‍♂️', `Tu n'as pas l'autorisation de rejoindre **${newChannel}**...`),
              fmtLine('📝', `Demande l\'accès à <@${ownerId}> pour rejoindre.`)
            ],
            client,
            data,
            guild,
            logMsg: `PV: ${member} expulsé de ${newChannel} (pas dans la liste d'accès).`
          });
          return;
        }
      }

      // ✅ Vérification Catlock
      if (newChannel.parentId && data.catlock.categories.includes(newChannel.parentId)) {
        const isWhitelisted = data.wl.includes(member.id);

        if (!isWhitelisted) {
          await handleKickFromVoice({
            member,
            reason: 'Catlock: WL requis',
            title: '🚫 Catlock — WL requis',
            description: [
              fmtLine('🔐', `Seuls les **WL** peuvent rester dans les vocaux de **${newChannel.parent?.name || 'cette catégorie'}**.`),
              fmtLine('🧾', `Demande à être ajouté WL via \`=wl @user\`.`)
            ],
            client,
            data,
            guild,
            logMsg: `Catlock: ${member} expulsé de ${newChannel} (non-WL).`
          });
          return;
        }
      }
    } catch (err) {
      console.error('[VoiceGuard] Erreur lors du traitement voiceStateUpdate :', err);
    }
  });
}

/**
 * Expulse un membre d'un salon vocal avec message explicatif + log.
 */
async function handleKickFromVoice({ member, reason, title, description, client, data, guild, logMsg }) {
  try {
    await member.voice.disconnect(reason);

    const embed = baseEmbed()
      .setTitle(title)
      .setDescription(description.join('\n'));

    await member.send({ embeds: [embed] }).catch(() => {});
    await logAction(client, data, guild, logMsg);
  } catch (err) {
    console.error(`[VoiceGuard] Impossible d'expulser ${member.user.tag} :`, err);
  }
}
