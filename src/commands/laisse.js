import { baseEmbed, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function laisse(client, message, args, data) {
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
        .setDescription('Utilisation: `=laisse @utilisateur`');
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

    if (!data.laisse) {
      data.laisse = {};
    }

    const ownerId = message.author.id;
    const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes

    data.laisse[targetId] = {
      ownerId: ownerId,
      expiresAt: expiresAt
    };

    safeWriteJson(DATA_PATH, data);

    const embed = baseEmbed()
      .setTitle('✅ Laisse activée')
      .setDescription(`**${targetMember.displayName}** est maintenant en laisse pendant 30 minutes.`);
    message.reply({ embeds: [embed] });

    // Notifier la cible
    try {
      const notifEmbed = baseEmbed()
        .setTitle('🎯 Tu es en laisse')
        .setDescription(`**${message.author.username}** t'a mis en laisse pendant 30 minutes.`);
      await targetMember.send({ embeds: [notifEmbed] });
    } catch {}

  } catch (error) {
    console.error('Erreur laisse:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}