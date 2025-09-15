// Placeholder pour la commande WL existante
import { baseEmbed } from '../utils.js';

export async function wl(client, message, args, data) {
  // Implémentation existante de la commande WL
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('👥 Commande WL')
    .setDescription('Commande WL - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}