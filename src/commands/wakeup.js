// Placeholder pour la commande WAKEUP existante
import { baseEmbed } from '../utils.js';

export async function wakeup(client, message, args, data) {
  // Implémentation existante de la commande WAKEUP
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('⏰ Commande Wakeup')
    .setDescription('Wakeup - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}