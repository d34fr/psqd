import { baseEmbed, fmtLine } from '../utils.js';
import { safeWriteJson, DATA_PATH } from '../utils.js';

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
      if (!data.catlock.categories || data.catlock.categories.length === 0) {
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

    const action = args[0].toLowerCase();
    
    if (action === 'add' || action === 'ajouter') {
      if (args.length < 2) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisation: `=catlock add <ID_catégorie>`');
        return message.reply({ embeds: [embed] });
      }

      const categoryId = args[1];
      const category = guild.channels.cache.get(categoryId);
      
      if (!category || category.type !== 4) { // 4 = CategoryChannel
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Catégorie invalide ou introuvable.');
        return message.reply({ embeds: [embed] });
      }

      if (data.catlock.categories.includes(categoryId)) {
        const embed = baseEmbed()
          .setTitle('⚠️ Déjà présent')
          .setDescription(`La catégorie **${category.name}** est déjà en catlock.`);
        return message.reply({ embeds: [embed] });
      }

      data.catlock.categories.push(categoryId);
      safeWriteJson(DATA_PATH, data);

      const embed = baseEmbed()
        .setTitle('✅ Catlock ajouté')
        .setDescription(`La catégorie **${category.name}** a été ajoutée au catlock.`);
      message.reply({ embeds: [embed] });

    } else if (action === 'remove' || action === 'supprimer' || action === 'del') {
      if (args.length < 2) {
        const embed = baseEmbed()
          .setTitle('❌ Erreur')
          .setDescription('Utilisation: `=catlock remove <ID_catégorie>`');
        return message.reply({ embeds: [embed] });
      }

      const categoryId = args[1];
      
      if (!data.catlock.categories.includes(categoryId)) {
        const embed = baseEmbed()
          .setTitle('⚠️ Non trouvé')
          .setDescription('Cette catégorie n\'est pas en catlock.');
        return message.reply({ embeds: [embed] });
      }

      data.catlock.categories = data.catlock.categories.filter(id => id !== categoryId);
      safeWriteJson(DATA_PATH, data);

      const category = guild.channels.cache.get(categoryId);
      const categoryName = category ? category.name : 'Catégorie supprimée';

      const embed = baseEmbed()
        .setTitle('✅ Catlock retiré')
        .setDescription(`La catégorie **${categoryName}** a été retirée du catlock.`);
      message.reply({ embeds: [embed] });

    } else {
      const embed = baseEmbed()
        .setTitle('❌ Action invalide')
        .setDescription('Actions disponibles: `add`, `remove`\nUtilise `=catlock` pour voir la liste.');
      message.reply({ embeds: [embed] });
    }

  } catch (error) {
    console.error('Erreur catlock:', error);
    const embed = baseEmbed()
      .setTitle('❌ Erreur')
      .setDescription('Une erreur est survenue lors de l\'exécution de la commande.');
    message.reply({ embeds: [embed] });
  }
}