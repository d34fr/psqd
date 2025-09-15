import { baseEmbed, fmtLine, channelToId, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function pv(client, message, args, data) {
  try {
    const guild = message.guild;
    if (!guild) return;

    const member = guild.members.cache.get(message.author.id);
    if (!member?.voice?.channelId) {
      const embed = baseEmbed()
        .setTitle('❌ Erreur')
        .setDescription('Tu dois être dans un salon vocal pour utiliser cette commande.');
      return message.reply({ embeds: [embed] });
    }

    const channelId = member.voice.channelId;
    const channel = guild.channels.cache.get(channelId);

    if (args.length === 0) {
      // Créer/gérer le PV
      if (data.pv.enabledChannels.includes(channelId)) {
        const ownerId = data.pv.owners[channelId];
        if (ownerId !== message.author.id) {
          const embed = baseEmbed()
            .setTitle('❌ Accès refusé')
            .setDescription('Tu n\'es pas le propriétaire de ce PV.');
          return message.reply({ embeds: [embed] });
        }

        const embed = baseEmbed()
          .setTitle('🔒 PV déjà actif')
          .setDescription(`Ce salon est déjà un PV. Utilise \`=pv add @user\` ou \`=pv remove @user\` pour gérer les accès.`);
        return message.reply({ embeds: [embed] });
      }

      // Créer le PV
      data.pv.enabledChannels.push(channelId);
      data.pv.owners[channelId] = message.author.id;
      if (!data.pv.access[channelId]) {
        data.pv.access[channelId] = [];
      }
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ PV créé')
        .setDescription(`**${channel.name}** est maintenant un salon privé. Tu en es le propriétaire.`);
      message.reply({ embeds: [embed] });
      return;
    }

    // Vérifier si c'est un PV et si l'utilisateur est propriétaire
    if (!data.pv.enabledChannels.includes(channelId)) {
      const embed = baseEmbed()
        .setTitle('❌ Erreur')
        .setDescription('Ce salon n\'est pas un PV. Utilise `=pv` pour le créer.');
      return message.reply({ embeds: [embed] });
    }

    const ownerId = data.pv.owners[channelId];
    if (ownerId !== message.author.id) {
      const embed = baseEmbed()
        .setTitle('❌ Accès refusé')
        .setDescription('Tu n\'es pas le propriétaire de ce PV.');
      return message.reply({ embeds: [embed] });
    }

    const action = args[0].toLowerCase();

    if (action === 'add' || action === 'ajouter') {
      if (args.length < 2) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisation: `=pv add @utilisateur`');
        return message.reply({ embeds: [embed] });
      }

      const targetId = userToId(args[1]);
      if (!targetId) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisateur invalide.');
        return message.reply({ embeds: [embed] });
      }

      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisateur introuvable sur ce serveur.');
        return message.reply({ embeds: [embed] });
      }

      if (data.pv.access[channelId].includes(targetId)) {
        const embed = baseEmbed()
          .setTitle('⚠️ Déjà autorisé')
          .setDescription(`**${targetMember.displayName}** a déjà accès à ce PV.`);
        return message.reply({ embeds: [embed] });
      }

      data.pv.access[channelId].push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Accès accordé')
        .setDescription(`**${targetMember.displayName}** a maintenant accès à ce PV.`);
      message.reply({ embeds: [embed] });

    } else if (action === 'remove' || action === 'supprimer' || action === 'del') {
      if (args.length < 2) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisation: `=pv remove @utilisateur`');
        return message.reply({ embeds: [embed] });
      }

      const targetId = userToId(args[1]);
      if (!targetId) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisateur invalide.');
        return message.reply({ embeds: [embed] });
      }

      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      if (!targetMember) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisateur introuvable sur ce serveur.');
        return message.reply({ embeds: [embed] });
      }

      if (!data.pv.access[channelId].includes(targetId)) {
        const embed = baseEmbed()
          .setTitle('⚠️ Pas autorisé')
          .setDescription(`**${targetMember.displayName}** n'a pas accès à ce PV.`);
        return message.reply({ embeds: [embed] });
      }

      data.pv.access[channelId] = data.pv.access[channelId].filter(id => id !== targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Accès retiré')
        .setDescription(`**${targetMember.displayName}** n'a plus accès à ce PV.`);
      message.reply({ embeds: [embed] });

    } else if (action === 'delete' || action === 'supprimer_pv') {
      // Supprimer le PV
      data.pv.enabledChannels = data.pv.enabledChannels.filter(id => id !== channelId);
      delete data.pv.owners[channelId];
      delete data.pv.access[channelId];
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ PV supprimé')
        .setDescription(`**${channel.name}** n'est plus un salon privé.`);
      message.reply({ embeds: [embed] });

    } else {
      const embed = baseEmbed()
        .setTitle('❌ Action invalide')
        .setDescription('Actions disponibles: `add`, `remove`, `delete`');
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur pv:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}