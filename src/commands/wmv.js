import { baseEmbed, userToId } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

export async function wmv(client, message, args, data) {
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
        .setDescription('Utilisation: `=wmv @utilisateur`');
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

    // Initialiser les structures si nécessaire
    if (!data.protect) data.protect = {};
    if (!data.protect.valid) data.protect.valid = {};
    if (!data.protect.valid.MOVE) data.protect.valid.MOVE = [];

    // Vérifier si l'utilisateur est wall (ajout automatique)
    const isWall = data.wall && data.wall.includes(targetId);
    const isAlreadyValid = data.protect.valid.MOVE.includes(targetId);

    if (isWall && !isAlreadyValid) {
      data.protect.valid.MOVE.push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Validé automatiquement (Wall)')
        .setDescription(`**${targetMember.displayName}** a été ajouté à la liste MOVE (utilisateur wall).`);
      return message.reply({ embeds: [embed] });
    }

    if (isAlreadyValid) {
      // Retirer de la liste
      data.protect.valid.MOVE = data.protect.valid.MOVE.filter(id => id !== targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Retiré de MOVE')
        .setDescription(`**${targetMember.displayName}** a été retiré de la liste MOVE.`);
      message.reply({ embeds: [embed] });
    } else {
      // Ajouter à la liste
      data.protect.valid.MOVE.push(targetId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Ajouté à MOVE')
        .setDescription(`**${targetMember.displayName}** a été ajouté à la liste MOVE.`);
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur wmv:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}