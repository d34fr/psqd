// Placeholder pour la commande FOLLOW existante
import { baseEmbed } from '../utils.js';

export async function follow(client, message, args, data) {
  // Implémentation existante de la commande FOLLOW
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('🎯 Commande Follow')
    .setDescription('Follow - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}