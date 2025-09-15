// Placeholder pour la commande SYS existante
import { baseEmbed } from '../utils.js';

export async function sys(client, message, args, data) {
  // Implémentation existante de la commande SYS
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('⚙️ Commande SYS')
    .setDescription('Commande SYS - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}