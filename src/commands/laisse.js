// Placeholder pour la commande LAISSE existante
import { baseEmbed } from '../utils.js';

export async function laisse(client, message, args, data) {
  // Implémentation existante de la commande LAISSE
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('🎯 Commande Laisse')
    .setDescription('Laisse - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}