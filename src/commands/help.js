import { baseEmbed } from '../utils.js';

export async function help(client, message, args, data) {
  try {
    const embed = baseEmbed()
      .setTitle('📋 Commandes disponibles')
      .setDescription('Voici les principales commandes du bot :')
      .addFields(
        { name: '🔒 **PV (Salons privés)**', value: '`=pv` - Gestion des salons privés\n`=pvinfo [ID]` - Infos sur un PV\n`=autoacc @user` - Auto-accès PV', inline: false },
        { name: '🛡️ **Protection vocale**', value: '`=wmv @user` - Valid MOVE\n`=wdc @user` - Valid DECO\n`=wmt @user` - Valid MUTE\n`=wall @user` - Wall (auto-valid)', inline: false },
        { name: '🔐 **Catlock**', value: '`=catlock` - Gestion catégories verrouillées', inline: false },
        { name: '👥 **Utilisateurs**', value: '`=wl @user` - Whitelist\n`=sys @user` - Système\n`=owner @user` - Propriétaire', inline: false },
        { name: '🎯 **Suivi**', value: '`=follow @user` - Suivre un utilisateur\n`=laisse @user` - Mettre en laisse', inline: false },
        { name: '⚙️ **Autres**', value: '`=panel` - Panneau de config\n`=wakeup @user` - Réveil\n`=helpall` - Toutes les commandes', inline: false }
      );

    message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur help:', error);
  }
}