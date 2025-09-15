// Placeholder pour la commande OWNER existante
import { baseEmbed } from '../utils.js';

export async function owner(client, message, args, data) {
  // Implémentation existante de la commande OWNER
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('👑 Commande OWNER')
    .setDescription('Commande OWNER - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}