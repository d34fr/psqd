import { baseEmbed, fmtLine, channelToId } from '../utils.js';

export async function pvinfo(client, message, args, data) {
  try {
    const guild = message.guild;
    if (!guild) return;

    let targetChannelId = null;

    if (args.length > 0) {
      // ID fourni en argument
      targetChannelId = channelToId(args[0]);
      if (!targetChannelId) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('ID de salon invalide.');
        return message.reply({ embeds: [embed] });
      }
    } else {
      // Pas d'ID fourni, utiliser le salon vocal actuel de l'utilisateur
      const member = guild.members.cache.get(message.author.id);
      if (!member?.voice?.channelId) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Tu n\'es pas dans un salon vocal et aucun ID n\'a été fourni.');
        return message.reply({ embeds: [embed] });
      }
      targetChannelId = member.voice.channelId;
    }

    // Vérifier si le salon existe
    const channel = guild.channels.cache.get(targetChannelId);
    if (!channel) {
      const embed = baseEmbed()
        .setTitle('❌ Erreur')
        .setDescription('Salon introuvable.');
      return message.reply({ embeds: [embed] });
    }

    // Vérifier si c'est un PV
    if (!data.pv.enabledChannels.includes(targetChannelId)) {
      const embed = baseEmbed()
        .setTitle('ℹ️ Information')
        .setDescription(`**${channel.name}** n'est pas un salon PV.`);
      return message.reply({ embeds: [embed] });
    }

    // Récupérer les informations du PV
    const ownerId = data.pv.owners[targetChannelId];
    const accessList = data.pv.access[targetChannelId] || [];

    const owner = ownerId ? await guild.members.fetch(ownerId).catch(() => null) : null;
    const ownerDisplay = owner ? `**${owner.displayName}** (\`${ownerId}\`)` : `Propriétaire introuvable (\`${ownerId}\`)`;

    let accessDisplay = 'Aucun utilisateur autorisé';
    if (accessList.length > 0) {
      const accessUsers = await Promise.all(
        accessList.map(async userId => {
          const user = await guild.members.fetch(userId).catch(() => null);
          return user ? `• **${user.displayName}** (\`${userId}\`)` : `• Utilisateur introuvable (\`${userId}\`)`;
        })
      );
      accessDisplay = accessUsers.join('\n');
    }

    const embed = baseEmbed()
      .setTitle('🔒 Informations PV')
      .addFields(
        { name: '📍 Salon', value: `**${channel.name}** (\`${targetChannelId}\`)`, inline: false },
        { name: '👑 Propriétaire', value: ownerDisplay, inline: false },
        { name: '✅ Utilisateurs autorisés', value: accessDisplay, inline: false }
      );

    message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Erreur pvinfo:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}