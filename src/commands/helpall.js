import { baseEmbed } from '../utils.js';

export async function helpall(client, message, args, data) {
  try {
    const embed = baseEmbed()
      .setTitle('📚 Toutes les commandes')
      .setDescription('Liste complète de toutes les commandes disponibles :')
      .addFields(
        { name: '🔒 **PV (Salons privés)**', value: '`=pv` - Créer/gérer un salon privé\n`=pvinfo [ID]` - Afficher les infos d\'un PV\n`=autoacc @user` - Ajouter un utilisateur en auto-accès\n`=autoacc` - Voir sa liste auto-accès', inline: false },
        { name: '🛡️ **Protection vocale**', value: '`=wmv @user` - Valider pour MOVE (ex: validmoov)\n`=wdc @user` - Valider pour DECO (ex: validdeco)\n`=wmt @user` - Valider pour MUTE (ex: validmute)\n`=wall @user` - Ajouter/retirer de wall (auto-valid)\n`=wall` - Voir la liste wall', inline: false },
        { name: '🔐 **Catlock**', value: '`=catlock` - Afficher les catégories catlock\n`=catlock add/remove` - Gérer les catégories', inline: false },
        { name: '👥 **Gestion utilisateurs**', value: '`=wl @user` - Ajouter/retirer de la whitelist\n`=sys @user` - Ajouter/retirer des permissions système\n`=owner @user` - Ajouter/retirer propriétaire', inline: false },
        { name: '🎯 **Suivi et contrôle**', value: '`=follow @user` - Suivre un utilisateur (30min)\n`=laisse @user` - Mettre en laisse (30min)\n`=wakeup @user` - Ajouter/retirer du réveil', inline: false },
        { name: '⚙️ **Configuration**', value: '`=panel` - Panneau de configuration\n`=help` - Aide rapide\n`=helpall` - Cette aide complète', inline: false }
      )
      .setFooter({ text: 'Préfixe: = | Certaines commandes nécessitent des permissions spéciales' });

    message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur helpall:', error);
  }
}