import { baseEmbed, fmtLine, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function wall(client, message, args, data) {
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
      // Afficher la liste des utilisateurs wall
      if (!data.wall || data.wall.length === 0) {
        const embed = baseEmbed()
          .setTitle('🧱 Wall')
          .setDescription('Aucun utilisateur n\'est actuellement wall.');
        return message.reply({ embeds: [embed] });
      }

      const userList = data.wall.map(userId => {
        const user = guild.members.cache.get(userId);
        return user ? `• **${user.displayName}** (\`${userId}\`)` : `• Utilisateur introuvable (\`${userId}\`)`;
      }).join('\n');

      const embed = baseEmbed()
        .setTitle('🧱 Utilisateurs Wall')
        .setDescription(userList);
      return message.reply({ embeds: [embed] });
    }

    // Ajouter/retirer un utilisateur wall
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

    if (!data.wall) {
      data.wall = [];
    }

    const isWall = data.wall.includes(targetId);
    
    if (isWall) {
      // Retirer de wall
      data.wall = data.wall.filter(id => id !== targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Wall retiré')
        .setDescription(`**${targetMember.displayName}** a été retiré de la liste wall.`);
      message.reply({ embeds: [embed] });
    } else {
      // Ajouter à wall
      data.wall.push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Wall ajouté')
        .setDescription(`**${targetMember.displayName}** a été ajouté à la liste wall.`);
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur wall:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}