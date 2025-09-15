import { baseEmbed, fmtLine } from '../utils.js';

export async function catlock(client, message, args, data) {
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
      // Afficher la liste des catégories catlock
      if (data.catlock.categories.length === 0) {
        const embed = baseEmbed()
          .setTitle('🔐 Catlock')
          .setDescription('Aucune catégorie n\'est actuellement en catlock.');
        return message.reply({ embeds: [embed] });
      }

      const categoryList = data.catlock.categories.map(catId => {
        const category = guild.channels.cache.get(catId);
        return category ? `• **${category.name}** (\`${catId}\`)` : `• Catégorie supprimée (\`${catId}\`)`;
      }).join('\n');

      const embed = baseEmbed()
        .setTitle('🔐 Catégories Catlock')
        .setDescription(categoryList);
      return message.reply({ embeds: [embed] });
    }

    // Logique existante pour ajouter/retirer des catégories...
    // (À implémenter selon le code existant)
    
  } catch (error) {
    console.error('Erreur catlock:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}