import { baseEmbed, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function owner(client, message, args, data) {
  try {
    const guild = message.guild;
    if (!guild) return;

    // Vérification des permissions (seuls les OWNER peuvent gérer OWNER)
    const isOwner = data.owner?.includes(message.author.id);

    if (!isOwner) {
      const embed = baseEmbed()
        .setTitle('❌ Accès refusé')
        .setDescription('Tu n\'as pas les permissions pour utiliser cette commande.');
      return message.reply({ embeds: [embed] });
    }

    if (args.length === 0) {
      // Afficher la liste OWNER
      if (!data.owner || data.owner.length === 0) {
        const embed = baseEmbed()
          .setTitle('👑 Propriétaires')
          .setDescription('Aucun propriétaire défini.');
        return message.reply({ embeds: [embed] });
      }

      const userList = data.owner.map(userId => {
        const user = guild.members.cache.get(userId);
        return user ? `• **${user.displayName}** (\`${userId}\`)` : `• Utilisateur introuvable (\`${userId}\`)`;
      }).join('\n');

      const embed = baseEmbed()
        .setTitle('👑 Propriétaires')
        .setDescription(userList);
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

    if (!data.owner) {
      data.owner = [];
    }

    const isOwnerTarget = data.owner.includes(targetId);
    
    if (isOwnerTarget) {
      // Retirer de OWNER
      data.owner = data.owner.filter(id => id !== targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ OWNER retiré')
        .setDescription(`**${targetMember.displayName}** n'est plus propriétaire.`);
      message.reply({ embeds: [embed] });
    } else {
      // Ajouter à OWNER
      data.owner.push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ OWNER ajouté')
        .setDescription(`**${targetMember.displayName}** est maintenant propriétaire.`);
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur owner:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}