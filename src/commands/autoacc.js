import { baseEmbed, fmtLine, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function autoacc(client, message, args, data) {
  try {
    const guild = message.guild;
    if (!guild) return;

    const authorId = message.author.id;

    if (args.length === 0) {
      // Afficher la liste des utilisateurs autoacc de l'utilisateur
      const userAutoAcc = data.autoacc[authorId] || [];
      
      if (userAutoAcc.length === 0) {
        const embed = baseEmbed()
          .setTitle('🔑 Auto-ACC')
          .setDescription('Tu n\'as aucun utilisateur en auto-acc.');
        return message.reply({ embeds: [embed] });
      }

      const userList = userAutoAcc.map(userId => {
        const user = guild.members.cache.get(userId);
        return user ? `• **${user.displayName}** (\`${userId}\`)` : `• Utilisateur introuvable (\`${userId}\`)`;
      }).join('\n');

      const embed = baseEmbed()
        .setTitle('🔑 Tes utilisateurs Auto-ACC')
        .setDescription(userList);
      return message.reply({ embeds: [embed] });
    }

    // Ajouter un utilisateur en auto-acc
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

    if (!data.autoacc[authorId]) {
      data.autoacc[authorId] = [];
    }

    if (data.autoacc[authorId].includes(targetId)) {
      const embed = baseEmbed()
        .setTitle('⚠️ Déjà présent')
        .setDescription(`**${targetMember.displayName}** est déjà dans ta liste auto-acc.`);
      return message.reply({ embeds: [embed] });
    }

    data.autoacc[authorId].push(targetId);
    safeWriteJson(DATA_PATH, data);

    const embed = baseEmbed()
      .setTitle('✅ Auto-ACC ajouté')
      .setDescription(`**${targetMember.displayName}** a été ajouté à ta liste auto-acc.`);
    message.reply({ embeds: [embed] });

  } catch (error) {
    console.error('Erreur autoacc:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}