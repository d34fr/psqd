// Placeholder pour la commande PV existante
import { baseEmbed } from '../utils.js';

export async function pv(client, message, args, data) {
  // Implémentation existante de la commande PV
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('🔒 Commande PV')
    .setDescription('Commande PV - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}