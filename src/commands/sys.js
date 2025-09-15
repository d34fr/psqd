import { baseEmbed, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function sys(client, message, args, data) {
  try {
    const guild = message.guild;
    if (!guild) return;

    // Vérification des permissions (seuls SYS+ et OWNER peuvent gérer SYS)
    const isSysPlus = data['sys+']?.includes(message.author.id);
    const isOwner = data.owner?.includes(message.author.id);

    if (!isSysPlus && !isOwner) {
      const embed = baseEmbed()
        .setTitle('❌ Accès refusé')
        .setDescription('Tu n\'as pas les permissions pour utiliser cette commande.');
      return message.reply({ embeds: [embed] });
    }

    if (args.length === 0) {
      // Afficher la liste SYS
      if (!data.sys || data.sys.length === 0) {
        const embed = baseEmbed()
          .setTitle('⚙️ Système')
          .setDescription('Aucun utilisateur n\'a les permissions système.');
        return message.reply({ embeds: [embed] });
      }

      const userList = data.sys.map(userId => {
        const user = guild.members.cache.get(userId);
        return user ? `• **${user.displayName}** (\`${userId}\`)` : `• Utilisateur introuvable (\`${userId}\`)`;
      }).join('\n');

      const embed = baseEmbed()
        .setTitle('⚙️ Utilisateurs Système')
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

    if (!data.sys) {
      data.sys = [];
    }

    const isSys = data.sys.includes(targetId);
    
    if (isSys) {
      // Retirer de SYS
      data.sys = data.sys.filter(id => id !== targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ SYS retiré')
        .setDescription(`**${targetMember.displayName}** n'a plus les permissions système.`);
      message.reply({ embeds: [embed] });
    } else {
      // Ajouter à SYS
      data.sys.push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ SYS ajouté')
        .setDescription(`**${targetMember.displayName}** a maintenant les permissions système.`);
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur sys:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}