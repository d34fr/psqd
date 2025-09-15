// Placeholder pour la commande PANEL existante
import { baseEmbed } from '../utils.js';

export async function panel(client, message, args, data) {
  // Implémentation existante de la commande PANEL
  // À migrer depuis le code existant
  const embed = baseEmbed()
    .setTitle('⚙️ Panneau de configuration')
    .setDescription('Panneau - À implémenter depuis le code existant');
  message.reply({ embeds: [embed] });
}