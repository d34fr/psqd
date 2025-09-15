import { baseEmbed, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function wl(client, message, args, data) {
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
      // Afficher la liste WL
      if (!data.wl || data.wl.length === 0) {
        const embed = baseEmbed()
          .setTitle('👥 Whitelist')
          .setDescription('Aucun utilisateur n\'est actuellement en whitelist.');
        return message.reply({ embeds: [embed] });
      }

      const userList = data.wl.map(userId => {
        const user = guild.members.cache.get(userId);
        return user ? `• **${user.displayName}** (\`${userId}\`)` : `• Utilisateur introuvable (\`${userId}\`)`;
      }).join('\n');

      const embed = baseEmbed()
        .setTitle('👥 Utilisateurs Whitelist')
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

    if (!data.wl) {
      data.wl = [];
    }

    const isWL = data.wl.includes(targetId);
    
    if (isWL) {
      // Retirer de WL
      data.wl = data.wl.filter(id => id !== targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ WL retiré')
        .setDescription(`**${targetMember.displayName}** a été retiré de la whitelist.`);
      message.reply({ embeds: [embed] });
    } else {
      // Ajouter à WL
      data.wl.push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ WL ajouté')
        .setDescription(`**${targetMember.displayName}** a été ajouté à la whitelist.`);
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur wl:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}