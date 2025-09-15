import { baseEmbed, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function follow(client, message, args, data) {
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

    if (args.length === 0) {
      const embed = baseEmbed()
        .setTitle('❌ Erreur')
        .setDescription('Utilisation: `=follow @utilisateur`');
      return message.reply({ embeds: [embed] });
    }

    const targetId = userToId(args[0]);
    if (!targetId) {
      const embed = baseEmbed()
        .setTitle('❌ Erreur')
        .setDescription('Utilisateur invalide. Utilise une mention ou un ID.');
      return message.reply({ embeds: [embed] });
    }

    const targetMember = await guild.members.fetch(targetId).catch(() => null);
    if (!targetMember) {
      const embed = baseEmbed()
        .setTitle('❌ Erreur')
        .setDescription('Utilisateur introuvable sur ce serveur.');
      return message.reply({ embeds: [embed] });
    }

    if (!data.follow) {
      data.follow = {};
    }

    const executorId = message.author.id;
    const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes

    data.follow[executorId] = {
      targetId: targetId,
      expiresAt: expiresAt
    };

    safeWriteJson(DATA_PATH, data);

    const embed = baseEmbed()
      .setTitle('✅ Follow activé')
      .setDescription(`Tu vas maintenant suivre **${targetMember.displayName}** pendant 30 minutes.`);
    message.reply({ embeds: [embed] });

    // Notifier la cible
    try {
      const notifEmbed = baseEmbed()
        .setTitle('🎯 Tu es suivi')
        .setDescription(`**${message.author.username}** te suit maintenant pendant 30 minutes.`);
      await targetMember.send({ embeds: [notifEmbed] });
    } catch {}

  } catch (error) {
    console.error('Erreur follow:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}