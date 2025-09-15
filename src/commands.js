import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Embed,
  AttachmentBuilder,
  ContainerBuilder,
  FileBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';

import {
  baseEmbed, fmtLine, userToId, channelToId, delay,
  getAllGuildVoiceChannels, loadJsonSafe, safeWriteJson,
  isValidSnowflake, withUserLock, canBotMoveInGuild, sortChannelsByCategoryThenName, logAction
} from './utils.js';



/** Permission resolution for command usage */
function userHasCommandAccess(member, data, command) {
  const uid = member.id;
  const isSysPlus = data['sys+'].includes(uid);
  const isSys = data.sys.includes(uid);
  const isOwner = data.owner.includes(uid);

  if (isSysPlus) return { ok: true, level: 'SYS+' };
  if (isSys) return { ok: true, level: 'SYS' };
  if (isOwner) return { ok: true, level: 'OWNER' };

  // Setup roles (find/mv/join/all)
  if (['find', 'mv', 'join'].includes(command)) {
    const roleIds = [
      ...(data.setupRoles?.[command] || []),
      ...(data.setupRoles?.all || [])
    ];
    if (member.roles.cache.some(r => roleIds.includes(r.id))) {
      return { ok: true, level: 'ROLE' };
    }
  }

  return { ok: false, level: 'NONE' };
}

function requireLevels(access, allowedLevels) {
  // allowedLevels: array of 'SYS+', 'SYS', 'OWNER', 'ROLE'
  if (!access.ok) return false;
  if (access.level === 'SYS+') return true;
  if (allowedLevels.includes(access.level)) return true;
  // Special rule: SYS implies OWNER
  if (access.level === 'SYS' && allowedLevels.includes('OWNER')) return true;
  return false;
}

function replyNoPerms(message, detail) {
  const e = baseEmbed()
    .setTitle('⛔ Accès refusé')
    .setDescription([
      fmtLine('🔒', `Tu n'as pas les permissions pour cette commande.`),
      detail ? fmtLine('ℹ️', detail) : ''
    ].filter(Boolean).join('\n'));
  return message.reply({ embeds: [e] });
}

async function persist(data, message) {
  try {
    safeWriteJson('permissions.json', data);
  } catch (e) {
    const ebd = baseEmbed().setTitle('⚠️ Erreur d\'écriture').setDescription('Impossible d\'écrire le fichier permissions.json');
    await message.reply({ embeds: [ebd] });
  }
}

/** === Helpers Protection & Follow/Leash === */
function ensureProtectDefaults(data) {
  if (!data.protect) data.protect = {};
  const p = data.protect;
  p.enabled = p.enabled || { MUTE: "false", DECO: "false", MOVE: "false" };
  p.window  = p.window  || { MUTE: "30",    DECO: "30",    MOVE: "30" };
  p.limit   = p.limit   || { MUTE: "3",     DECO: "3",     MOVE: "3"  };
  p.valid   = p.valid   || { MUTE: [],      DECO: [],      MOVE: []   };
  if (!Array.isArray(p.valid.MUTE)) p.valid.MUTE = [];
  if (!Array.isArray(p.valid.DECO)) p.valid.DECO = [];
  if (!Array.isArray(p.valid.MOVE)) p.valid.MOVE = [];
  if (!data.follow) data.follow = {};
  if (!data.laisse) data.laisse = {};
  return data;
}

/** ====================== COMMANDS ====================== */
export async function handleCommand(client, message, data, prefix) {
  if (!message.guild || message.author.bot) return;

  const [raw, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = raw?.toLowerCase();
  if (!cmd) return;

  const access = userHasCommandAccess(message.member, data, cmd);

  switch (cmd) {
    /* ---------------- HELP ---------------- */
    case 'help': {
      // Embed initial
      const initialEmbed = new EmbedBuilder()
        .setTitle('📖 Aide — Voice Manager')
        .setDescription('**Sélectionne une catégorie dans le menu ci-dessous pour afficher les commandes.**\n\n**・**_Prefix actuel : `=`_\n**・**Si vous souhaitez voir toutes les commandes, faites `=helpall`.')
        .setColor(0x000000)
        .setFooter({ text: 'Voice Manager ©' });

      // Menu déroulant (+ Anti-Abus)
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_menu')
        .setPlaceholder('Choisis une catégorie')
        .addOptions([
          { emoji: '📒', label: 'Commandes basiques', value: 'basique', description: 'Commandes générales et de déplacement' },
          { emoji: '🔒', label: 'PV', value: 'pv', description: 'Commandes vocaux PV' },
          { emoji: '🛡️', label: 'Anti-Abus', value: 'antiabuse', description: 'Protection vocale & allowlists' },
          { emoji: '⚙',  label: 'Configuration', value: 'config', description: 'Commandes de configuration' },
          { emoji: '💡', label: 'Informations', value: 'info', description: 'Informations & Hiérarchie'},
        ]);

      // Bouton avec lien
      const helpButton = new ButtonBuilder()
        .setLabel('Support (Inexistant)')
        .setEmoji('🔗')
        .setStyle(ButtonStyle.Link)
        .setURL('https://discord.gg/itamori');

      const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
      const rowButton = new ActionRowBuilder().addComponents(helpButton);

      const msg = await message.reply({ embeds: [initialEmbed], components: [rowMenu, rowButton] });

      const filter = i => i.user.id === message.author.id;
      const collector = msg.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, time: 120000 });

      collector.on('collect', async i => {
        let embed;

        switch (i.values[0]) {
          case 'basique':
            embed = new EmbedBuilder()
              .setTitle('📖 Commandes basiques')
              .setDescription([
                '**🏷〃Général**',
                '',
                fmtLine('🔎', '`=find <@user|ID>`\n**・** Trouve le vocal de la cible.\n**・ Accès :** Owner & Rôle Setup'),
                '',
                fmtLine('🧲', '`=join <@user|ID>`\n**・** Te déplace vers le vocal de la cible.\n**・ Accès :** Owner & Rôle Setup'),
                '',
                fmtLine('🔄', '`=mv <@user|ID>`\n**・** Amène la cible dans ton vocal.\n**・ Accès :** Owner & Rôle Setup'),
                '',
                fmtLine('⏰', '`=wakeup <@user|ID>`\n**・** 15 moves aléatoires puis retour.\n**・ Accès :** Sys'),
                '',
                fmtLine('📊', '`=vc`\n**・** Affiche le nombre de membres en vocal.\n**・ Accès :** Public'),
                '',
                '',
                fmtLine('🔀', '`=mvc <ID 1> <ID 2>`\n**・** Déplace tout un vocal vers un autre.\n**・ Accès :** Sys'),
                '',
                fmtLine('🌐', '`=mvall <ID>`\n**・** Déplace tout le monde en vocal vers un vocal.\n**・ Accès :** Sys'),
                '',
                fmtLine('🎲', '`=mvd <ID>`\n**・** Déplace les membres d’un vocal vers des vocaux aléatoires.\n**・ Accès :** Sys'),
                '',
                '',
                fmtLine('👣', '`=follow <@user|ID>`\n**・** Tu suis la cible (moves auto 30min).\n**・ Accès :** Owner'),
                '',
                fmtLine('🛑', '`=unfollow`\n**・** Arrête de suivre.\n**・ Accès :** Owner'),
                '',
                fmtLine('🔗', '`=laisse <@user|ID>`\n**・** Laisse 30min : si **toi** tu bouges, **elle** bouge.\n**・ Accès :** Owner'),
                '',
                fmtLine('✂️', '`=unlaisse <@user|ID>`\n**・** Retire la laisse.\n**・ Accès :** Owner'),
                '',
                fmtLine('🧹', '`=fldelete`\n**・** Supprime tous les follow/laisse en cours.\n**・ Accès :** Sys+'),
              ].join('\n'))
              .setFooter({ text: 'Voice Manager ©' })
              .setColor(0x000000);
            break;

          case 'pv':
            embed = new EmbedBuilder()
              .setTitle('📖 Commandes PV')
              .setDescription([
                fmtLine('🪓', '`=pv [voiceId]`\n**・** Toggle PV sur un vocal.\n**・ Accès :** Owner'),
                '',
                fmtLine('📜', '`=pvlist`\n**・** Affiche la liste de vocaux PV.\n**・ Accès :** Owner'),
                '',
                fmtLine('🧾', '`=acc <@user|ID>`\n**・** Toggle accès pour le PV courant.\n**・ Accès :** Propriétaire du PV'),
                '',
                fmtLine('🧹', '`=pvdelete`\n**・** Supprime tous les PV actifs.\n**・ Accès :** Sys'),
                '',
                '',
                fmtLine('🚪', '`=catlock <categoryId>`\n**・** Active le CatLock sur une catégorie.\n**・ Accès :** Sys'),
              ].join('\n'))
              .setFooter({ text: 'Voice Manager ©' })
              .setColor(0x000000);
            break;

          case 'antiabuse':
            embed = new EmbedBuilder()
              .setTitle('🛡️ Anti-Abus vocal')
              .setDescription([
                fmtLine('🖥️', '`=panel`\n**・** Ouvre le panneau de configuration.\n**・ Accès :** Sys+'),
                '',
                fmtLine('✅', '`=validdeco [@/ID]`\n**・** Gére ou Affiche la list des ValidDeco.\n**・ Accès :** Sys'),
                '',
                fmtLine('✅', '`=validmute [@/ID]`\n**・** Gére ou Affiche la list des ValidMute.\n**・ Accès :** Sys'),
                '',
                fmtLine('✅', '`=validmoov [@/ID]`\n**・** Gére ou Affiche la list des ValidMoov **MOVE**.\n**・ Accès :** Sys'),
              ].join('\n'))
              .setFooter({ text: 'Voice Manager ©' })
              .setColor(0x000000);
            break;

          case 'config':
            embed = new EmbedBuilder()
              .setTitle('📖 Commandes Configuration')
              .setDescription([
                fmtLine('🛡️', '`=sys <@user|ID>`\n**・** Gére ou Affiche la list des SYS.\n**・ Accès :** Sys+'),
                '',
                fmtLine('👑', '`=owner <@user|ID>`\n**・** Gére ou Affiche la list des OWNER.\n**・ Accès :** Sys'),
                '',
                fmtLine('✅', '`=wl <@user|ID>`\n**・** Gére ou Affiche la list des WL.\n**・ Accès :** Owner'),
                '',
                '',
                fmtLine('🧩', '`=setup <find|mv|join|all> <@Role>`\n**・** Rôles autorisés pour les commandes.\n**・ Accès :** Sys'),
                '',
                fmtLine('📄', '`=setup`\n**・** Affiche toute la liste des rôles → Perm.\n**・ Accès :** Sys'),
                '',
                '',
                fmtLine('📂', '`=setlogs <#salon|ID>`\n**・** Définit le salon de logs.\n**・ Accès :** Sys'),
              ].join('\n'))
              .setFooter({ text: 'Voice Manager ©' })
              .setColor(0x000000);
            break;

            case 'info':
            embed = new EmbedBuilder()
            .setTitle('💡 Informations')
            .setDescription([
              '👑〃Hiérarchie des Permissions',
              '┏ `⚪` Sys+ (Owner Bot)',
              '┣ `🌐` Sys',
              '┣ `👑` Owner',
              '┣ `✅` WL',
              '┗ `🎭` Rôle Setup',
              fmtLine('🔓', 'Si une commande est **reservé** au **Owner**, les **Sys** y auront aussi **accès**. Si une commande est reservé au **WL** les **Owners** y auront aussi **accès** ect..'),
              '',
              '',
              '📚〃Panel & Protection',
              fmtLine('⛔', 'Si dépassement de limite → **derank** (retrait des rôles).'),
              fmtLine('🛑', 'Les **SYS / SYS+** et **allowlist** sont **exemptés** de sanction, mais **logués**.'),
              fmtLine('🌐', 'Sur le **Setup**, **ALL représente** uniquement les commandes **find, mv et join**.'),
              '',
              '🚧 Vocaux PV',
              fmtLine('🚪', 'Les **acces** se **supprime automatiquement** après que le **PV** soit **supprimer**.'),
              fmtLine('🌏', 'Pour avoir accès au **CatLock**, il faut uniquement être **WL**')
              ].join('\n'))
              .setFooter({ text: 'Voice Manager ©' })
              .setColor(0x000000);
            break;
        }

        await i.update({ embeds: [embed], components: [rowMenu, rowButton] });
      });

      collector.on('end', () => {
        selectMenu.setDisabled(true);
        msg.edit({ components: [rowMenu, rowButton] }).catch(() => {});
      });

      break;
    }

    case 'helpall': {
  const embed = new EmbedBuilder()
    .setTitle('📖 Toutes les Commandes')
    .setDescription([
      `**Préfixe actuel** : \`${prefix}\`\n`,
      '🏷〃Général',
      fmtLine('🔎', '`=find <@user|ID>` — Trouve le vocal de la cible.'),
      fmtLine('🧲', '`=join <@user|ID>` — Te déplace vers le vocal de la cible.'),
      fmtLine('🔄', '`=mv <@user|ID>` — Amène la cible dans ton vocal.'),
      fmtLine('⏰', '`=wakeup <@user|ID>` — 15 moves aléatoires puis retour.'),
      fmtLine('📊', '`=vc` — Affiche le nombre de membres en vocal.\n'),

      '🚶‍♀️〃Déplacement',
      fmtLine('🔀', '`=mvc <ID 1> <ID 2>` — Déplace tout un vocal vers un autre.'),
      fmtLine('🌐', '`=mvall <ID>` — Déplace tout le monde en vocal vers un vocal.'),
      fmtLine('🎲', '`=mvd <ID>` — Déplace les membres d’un vocal vers des vocaux aléatoires.\n'),

      '🧷〃Suivi & Laisse',
      fmtLine('👣', '`=follow <@user|ID>` — Suivre la cible 30min.'),
      fmtLine('🛑', '`=unfollow` — Arrête de suivre.'),
      fmtLine('🔗', '`=laisse <@user|ID>` — Laisse 30min.'),
      fmtLine('✂️', '`=unlaisse <@user|ID>` — Retire la laisse.'),
      fmtLine('🧹', '`=fldelete` — Supprime tous les follow/laisse.\n'),

      '🔒〃PV',
      fmtLine('🪓', '`=pv [voiceId]` — Toggle PV sur un vocal.'),
      fmtLine('🧾', '`=acc <@user|ID>` — Toggle accès pour le PV courant.'),
      fmtLine('🧹', '`=pvdelete` — Supprime tous les PV Actifs.'),
      fmtLine('📜', '`=pvlist` — Affiche la liste de vocaux PV.\n'),

      '🗄〃CatLock',
      fmtLine('🚪', '`=catlock <categoryId>` — Active le CatLock sur une catégorie.\n'),

      '🛡️〃Anti-Abus',
      fmtLine('🖥️', '`=panel` — Configurer DECO/MUTE/MOVE (on/off, fenêtre, limite).'),
      fmtLine('✅', '`=validdeco [@/ID]` — Allowlist DECO (toggle ou liste).'),
      fmtLine('✅', '`=validmute [@/ID]` — Allowlist MUTE (toggle ou liste).'),
      fmtLine('✅', '`=validmoov [@/ID]` — Allowlist MOVE (toggle ou liste).\n'),

      '🔗〃Configuration',
      fmtLine('🛡️', '`=sys <@user|ID>` — Gérer SYS.'),
      fmtLine('👑', '`=owner <@user|ID>` — Gérer OWNER.'),
      fmtLine('✅', '`=wl <@user|ID>` — Gérer WL.\n'),

      fmtLine('🧩', '`=setup <find|mv|join|all> <@Role>` — Rôles autorisés pour les commandes.'),
      fmtLine('📄', '`=setup` — Affiche toute la liste des rôles → Perm.\n'),

      fmtLine('📂', '`=setlogs <#salon|ID>` — Définit le salon de logs.')
    ].join('\n'))
    .setFooter({ text: 'Voice Manager ©' })
    .setColor(0x000000);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Support (Inexistant)')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Link)
          .setURL('https://guns.lol/d34fr')
      );

      await message.reply({ embeds: [embed], components: [row] });
      break;
    }

    /* ---------------- FIND ---------------- */
    case 'find': {
      if (!requireLevels(access, ['SYS', 'OWNER', 'WL', 'ROLE'])) {
        return replyNoPerms(message, 'Besoin d\'être Owner/Sys ou d\'avoir un rôle associé via `=setup find`.');
      }
      const targetId = userToId(args[0]);
      if (!targetId) {
        const e = baseEmbed().setTitle('❓ Cible invalide').setDescription(fmtLine('🧭', 'Utilise `=find <@user|ID>`.'));
        return message.reply({ embeds: [e] });
      }
      const member = await message.guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        const e = baseEmbed().setTitle('🙈 Introuvable').setDescription(fmtLine('🧭', 'Utilisateur introuvable sur ce serveur.'));
        return message.reply({ embeds: [e] });
      }
      const ch = member.voice.channel;
      const desc = ch
        ? fmtLine('🎧', `**${member.user.tag}** est dans **${ch.name}** (${ch}).`)
        : fmtLine('🛌', `**${member.user.tag}** n'est **pas** en vocal.`);
      const e = baseEmbed().setTitle('🔎 Find').setDescription(desc);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- JOIN ---------------- */
    case 'join': {
      if (!requireLevels(access, ['SYS', 'OWNER', 'ROLE'])) {
        return replyNoPerms(message, 'Besoin d\'être Owner/Sys ou rôle `join` via `=setup`.');
      }
      const me = message.guild.members.me;
      if (!canBotMoveInGuild(message.guild, me)) {
        const e = baseEmbed().setTitle('⚠️ Permissions manquantes').setDescription(fmtLine('🛑', 'Le bot a besoin de **Move Members, Connect, View Channel**.'));
        return message.reply({ embeds: [e] });
      }
      const authorCh = message.member.voice.channel;
      if (!authorCh) {
        const e = baseEmbed().setTitle('🗣️ Pas en vocal').setDescription(fmtLine('🎧', 'Tu dois être **en vocal**.'));
        return message.reply({ embeds: [e] });
      }
      const targetId = userToId(args[0]);
      if (!targetId) {
        const e = baseEmbed().setTitle('❓ Cible invalide').setDescription(fmtLine('🧭', 'Utilise `=join <@user|ID>`.'));
        return message.reply({ embeds: [e] });
      }
      const target = await message.guild.members.fetch(targetId).catch(() => null);
      if (!target || !target.voice.channel) {
        const e = baseEmbed().setTitle('🙅 Cible pas en vocal').setDescription(fmtLine('🔎', 'La cible n\'est pas en vocal.'));
        return message.reply({ embeds: [e] });
      }
      await message.member.voice.setChannel(target.voice.channel, 'join vers la cible');
      const e = baseEmbed().setTitle('🧲 Join')
        .setDescription(fmtLine('➡️', `Déplacé vers **${target.voice.channel}**.`));
      await logAction(client, data, message.guild, `${message.member} join ${target.voice.channel}`);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- MV ---------------- */
    case 'mv': {
      if (!requireLevels(access, ['SYS', 'OWNER', 'ROLE'])) {
        return replyNoPerms(message, 'Besoin d\'être Owner/Sys ou rôle `mv` via `=setup`.');
      }
      const me = message.guild.members.me;
      if (!canBotMoveInGuild(message.guild, me)) {
        const e = baseEmbed().setTitle('⚠️ Permissions manquantes').setDescription(fmtLine('🛑', 'Le bot a besoin de **Move Members, Connect, View Channel**.'));
        return message.reply({ embeds: [e] });
      }
      const authorCh = message.member.voice.channel;
      if (!authorCh) {
        const e = baseEmbed().setTitle('🗣️ Pas en vocal').setDescription(fmtLine('🎧', 'Tu dois être **en vocal**.'));
        return message.reply({ embeds: [e] });
      }
      const targetId = userToId(args[0]);
      if (!targetId) {
        const e = baseEmbed().setTitle('❓ Cible invalide').setDescription(fmtLine('🧭', 'Utilise `=mv <@user|ID>`.'));
        return message.reply({ embeds: [e] });
      }
      const target = await message.guild.members.fetch(targetId).catch(() => null);
      if (!target) {
        const e = baseEmbed().setTitle('🙈 Introuvable').setDescription(fmtLine('🧭', 'Utilisateur introuvable.'));
        return message.reply({ embeds: [e] });
      }
      if (!target.voice.channel) {
        const e = baseEmbed().setTitle('🙅 Cible pas en vocal').setDescription(fmtLine('🔎', 'La cible n\'est pas en vocal.'));
        return message.reply({ embeds: [e] });
      }
      await target.voice.setChannel(authorCh, `mv par ${message.author.tag}`);
      const e = baseEmbed().setTitle('🫳 Move')
        .setDescription(fmtLine('➡️', `**${target.user.tag}** a été déplacé vers **${authorCh}**.`));
      await logAction(client, data, message.guild, `mv: ${target} -> ${authorCh} par ${message.member}`);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- MVC ---------------- */
    case 'mvc': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé aux SYS.');
      }
      const [sourceId, destId] = args;
      if (!isValidSnowflake(sourceId) || !isValidSnowflake(destId)) {
        const e = baseEmbed().setTitle('❓ Usage')
          .setDescription(fmtLine('🧭', 'Utilise `=mvc <ID source> <ID destination>`.'));
        return message.reply({ embeds: [e] });
      }
      const source = message.guild.channels.cache.get(sourceId);
      const dest = message.guild.channels.cache.get(destId);
      if (!source || !dest || source.type !== ChannelType.GuildVoice || dest.type !== ChannelType.GuildVoice) {
        const e = baseEmbed().setTitle('🙅 Vocaux invalides')
          .setDescription(fmtLine('🔎', 'Les deux IDs doivent être des salons vocaux.'));
        return message.reply({ embeds: [e] });
      }
      for (const member of source.members.values()) {
        await member.voice.setChannel(dest, `mvc par ${message.author.tag}`).catch(() => {});
      }
      const e = baseEmbed().setTitle('🔄 MVC')
        .setDescription(fmtLine('➡️', `Membres déplacés de **${source.name}** vers **${dest.name}**.`));
      await logAction(client, data, message.guild, `mvc ${source.name} -> ${dest.name} par ${message.member}`);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- MVALL ---------------- */
    case 'mvall': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé aux SYS.');
      }
      const destId = args[0];
      if (!isValidSnowflake(destId)) {
        const e = baseEmbed().setTitle('❓ Usage')
          .setDescription(fmtLine('🧭', 'Utilise `=mvall <ID destination>`.'));
        return message.reply({ embeds: [e] });
      }
      const dest = message.guild.channels.cache.get(destId);
      if (!dest || dest.type !== ChannelType.GuildVoice) {
        const e = baseEmbed().setTitle('🙅 Vocal invalide')
          .setDescription(fmtLine('🔎', 'L’ID doit être un salon vocal.'));
        return message.reply({ embeds: [e] });
      }

      const confirmEmbed = baseEmbed()
        .setTitle('⚠️ Confirmation requise')
        .setDescription([
          fmtLine('❓', `Veux-tu **déplacer tout le monde** vers **${dest.name}** ?`),
          fmtLine('⏳', 'Attends **3 secondes** avant de cliquer.')
        ].join('\n'));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_yes').setLabel('✅ Oui').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('confirm_no').setLabel('❌ Non').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      const msg = await message.reply({ embeds: [confirmEmbed], components: [row] });

      setTimeout(async () => {
        row.components.forEach(btn => btn.setDisabled(false));
        await msg.edit({ components: [row] });
      }, 3000);

      const collector = msg.createMessageComponentCollector({ time: 15000 });
      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ Pas pour toi', ephemeral: true });
        }

        if (i.customId === 'confirm_yes') {
          await i.update({ content: '✅ Déplacement en cours...', embeds: [], components: [] });

          const all = getAllGuildVoiceChannels(message.guild);
          for (const ch of all.values()) {
            for (const member of ch.members.values()) {
              await member.voice.setChannel(dest, `mvall par ${message.author.tag}`).catch(() => {});
            }
          }
          const doneEmbed = baseEmbed().setTitle('🌐 MVALL')
            .setDescription(fmtLine('➡️', `Tous les membres en vocal ont été déplacés vers **${dest.name}**.`));
          await logAction(client, data, message.guild, `mvall vers ${dest.name} par ${message.member}`);
          return msg.edit({ embeds: [doneEmbed], components: [] });
        }

        if (i.customId === 'confirm_no') {
          await i.update({ content: '❌ Action annulée.', embeds: [], components: [] });
        }
      });

      return;
    }

    /* ---------------- MVD ---------------- */
    case 'mvd': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé aux SYS.');
      }
      const sourceId = args[0];
      if (!isValidSnowflake(sourceId)) {
        const e = baseEmbed().setTitle('❓ Usage')
          .setDescription(fmtLine('🧭', 'Utilise `=mvd <ID vocal>`.'));
        return message.reply({ embeds: [e] });
      }
      const source = message.guild.channels.cache.get(sourceId);
      if (!source || source.type !== ChannelType.GuildVoice) {
        const e = baseEmbed().setTitle('🙅 Vocal invalide')
          .setDescription(fmtLine('🔎', 'L’ID doit être un salon vocal.'));
        return message.reply({ embeds: [e] });
      }

      const confirmEmbed = baseEmbed()
        .setTitle('⚠️ Confirmation requise')
        .setDescription([
          fmtLine('❓', `Veux-tu **déplacer aléatoirement** tous les membres de **\`${source.name}\`** ?`),
          fmtLine('⏳', 'Attends **3 secondes** avant de cliquer.')
        ].join('\n'));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm_yes').setLabel('✅ Oui').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('confirm_no').setLabel('❌ Non').setStyle(ButtonStyle.Danger).setDisabled(true)
      );

      const msg = await message.reply({ embeds: [confirmEmbed], components: [row] });

      setTimeout(async () => {
        row.components.forEach(btn => btn.setDisabled(false));
        await msg.edit({ components: [row] });
      }, 3000);

      const collector = msg.createMessageComponentCollector({ time: 15000 });
      collector.on('collect', async (i) => {
        if (i.user.id !== message.author.id) {
          return i.reply({ content: '❌ Pas pour toi', ephemeral: true });
        }

        if (i.customId === 'confirm_yes') {
          await i.update({ content: '✅ Déplacement en cours...', embeds: [], components: [] });

          const all = getAllGuildVoiceChannels(message.guild);
          const candidates = [...all.values()].filter(ch => ch.id !== sourceId && ch.type === ChannelType.GuildVoice);
          for (const member of source.members.values()) {
            const perms = candidates.filter(ch => ch.permissionsFor(member)?.has(PermissionFlagsBits.Connect));
            if (perms.length) {
              const choice = perms[Math.floor(Math.random() * perms.length)];
              await member.voice.setChannel(choice, `mvd aléatoire par ${message.author.tag}`).catch(() => {});
            }
          }

          const doneEmbed = baseEmbed().setTitle('🎲 MVD')
            .setDescription(fmtLine('➡️', `Membres déplacés aléatoirement depuis **\`${source.name}\`**.`));
          await logAction(client, data, message.guild, `mvd ${source.name} par ${message.member}`);
          return msg.edit({ embeds: [doneEmbed], components: [] });
        }

        if (i.customId === 'confirm_no') {
          await i.update({ content: '❌ Action annulée.', embeds: [], components: [] });
        }
      });

      return;
    }

    /* ---------------- WAKEUP ---------------- */
    case 'wakeup': {
  if (!requireLevels(access, ['SYS'])) {
    return replyNoPerms(message, 'Réservé à SYS/SYS+.');
  }
  const me = message.guild.members.me;
  if (!canBotMoveInGuild(message.guild, me)) {
    const e = baseEmbed().setTitle('⚠️ Permissions manquantes').setDescription(fmtLine('🛑', 'Le bot a besoin de **Move Members, Connect, View Channel**.'));
    return message.reply({ embeds: [e] });
  }
  const targetId = userToId(args[0]);
  if (!targetId) {
    const e = baseEmbed().setTitle('❓ Cible invalide').setDescription(fmtLine('🧭', 'Utilise `=wakeup <@user|ID>`.'));
    return message.reply({ embeds: [e] });
  }
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target || !target.voice.channel) {
    const e = baseEmbed().setTitle('🙅 Cible pas en vocal').setDescription(fmtLine('🔎', 'La cible n\'est pas en vocal.'));
    return message.reply({ embeds: [e] });
  }

  const all = getAllGuildVoiceChannels(message.guild);
  const candidates = [...all.values()].filter(ch => {
    if (ch.id === message.guild.afkChannelId) return false;
    if (ch.type === ChannelType.GuildStageVoice) return false;
    const perms = ch.permissionsFor(target);
    const canConnect = perms?.has(PermissionFlagsBits.Connect);
    return Boolean(canConnect);
  });

  if (candidates.length < 1) {
    const e = baseEmbed().setTitle('😴 Pas de salons adaptés').setDescription(fmtLine('🧭', 'Aucun salon vocal joignable trouvé.'));
    return message.reply({ embeds: [e] });
  }

  const original = target.voice.channel;

  // 🔹 Message au début
  const start = baseEmbed().setTitle('⏰ Wakeup lancé')
    .setDescription(fmtLine('🔁', `**${target.user.tag}** est en train d'être déplacé aléatoirement...`));
  await message.reply({ embeds: [start] });
  await logAction(client, data, message.guild, `⏰ Wakeup executé :\n\`👤\`〃Sur : ${target}\n\`👮‍♀️\`〃Par :${message.member}`);

  // 🔹 Exécution du shuffle
  await withUserLock(target.id, async () => {
    for (let i = 0; i < 15; i++) {
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      try {
        await target.voice.setChannel(choice, 'wakeup shuffle');
      } catch {}
      await delay(300);
    }
    try {
      if (original) await target.voice.setChannel(original, 'wakeup retour');
    } catch {}
  });

  // 🔹 Message quand c'est fini
  const end = baseEmbed().setTitle('✅ Wakeup terminé')
    .setDescription(fmtLine('🔕', `**${target.user.tag}** a été déplacé 15× aléatoirement puis renvoyé dans **${original}**.`));
  await message.channel.send({ embeds: [end] });
}


    /* ---------------- SYS / OWNER / WL ---------------- */
    case 'sys':
    case 'owner':
    case 'wl': {
      const listOnly = args.length === 0;
      if (listOnly) {
        const arr = data[cmd] || [];
        const display = arr.length
          ? arr.map(id => `<@${id}> — \`${id}\``).join('\n')
          : '_Aucun_';
        const e = baseEmbed().setTitle(`📇 Liste ${cmd.toUpperCase()}`)
          .setDescription(display);
        if (cmd === 'sys') {
          if (!requireLevels(access, ['SYS'])) return replyNoPerms(message, 'Liste SYS visible par SYS/SYS+.');
        } else if (cmd === 'owner') {
          if (!requireLevels(access, ['SYS'])) return replyNoPerms(message, 'Liste OWNER visible par SYS/SYS+.');
        } else if (cmd === 'wl') {
          if (!requireLevels(access, ['SYS','OWNER'])) return replyNoPerms(message, 'Liste WL visible par Owner & Sys.');
        }
        return message.reply({ embeds: [e] });
      }

      const targetId = userToId(args[0]);
      if (!targetId) {
        const e = baseEmbed().setTitle('❓ Cible invalide').setDescription(fmtLine('🧭', `Utilise \`=${cmd} <@user|ID>\`.`));
        return message.reply({ embeds: [e] });
      }

      if (cmd === 'sys') {
        if (!requireLevels(access, ['SYS+'])) return replyNoPerms(message, 'Réservé au Owner Bot (SYS+).');
      } else if (cmd === 'owner') {
        if (!requireLevels(access, ['SYS'])) return replyNoPerms(message, 'Réservé à SYS/SYS+.');
      } else if (cmd === 'wl') {
        if (!requireLevels(access, ['OWNER','SYS'])) return replyNoPerms(message, 'Réservé à Owner/SYS/SYS+.');
      }

      let action = '';
      data[cmd] = data[cmd] || [];
      const index = data[cmd].indexOf(targetId);
      if (index >= 0) {
        data[cmd].splice(index, 1);
        action = 'remove';
      } else {
        data[cmd].push(targetId);
        action = 'add';
      }
      await persist(data, message);

      const titles = {
        sys: action === 'add' ? '🛡️ Ajouté en SYS' : '🛡️ Retiré de SYS',
        owner: action === 'add' ? '👑 Ajouté en OWNER' : '👑 Retiré de OWNER',
        wl: action === 'add' ? '✅ Ajouté en WL' : '✅ Retiré de WL'
      };

      const e = baseEmbed()
        .setTitle(titles[cmd])
        .setDescription(fmtLine(action === 'add' ? '➕' : '➖', `<@${targetId}> ${action === 'add' ? 'ajouté' : 'retiré'}.`));

      await logAction(client, data, message.guild, `${cmd}: ${action.toUpperCase()} <@${targetId}> par ${message.member}`);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- PV TOGGLE ---------------- */
    case 'pv': {
      if (!requireLevels(access, ['SYS','OWNER', 'WL'])) {
        return replyNoPerms(message, 'Réservé à Owner & Sys.');
      }
      let voiceId = channelToId(args[0]);
      if (!voiceId) {
        const ch = message.member.voice.channel;
        if (!ch) {
          const e = baseEmbed().setTitle('🗣️ Pas en vocal').setDescription(fmtLine('🎧', 'Spécifie un ID ou sois en vocal.'));
          return message.reply({ embeds: [e] });
        }
        voiceId = ch.id;
      }
      const voice = message.guild.channels.cache.get(voiceId);
      if (!voice || (voice.type !== ChannelType.GuildVoice && voice.type !== ChannelType.GuildStageVoice)) {
        const e = baseEmbed().setTitle('🧭 Salon invalide').setDescription(fmtLine('🔎', 'ID de vocal invalide.'));
        return message.reply({ embeds: [e] });
      }
      const isEnabled = data.pv.enabledChannels.includes(voiceId);
      if (isEnabled) {
        data.pv.enabledChannels = data.pv.enabledChannels.filter(id => id !== voiceId);
        delete data.pv.owners[voiceId];
        delete data.pv.access[voiceId];
        await persist(data, message);
        const e = baseEmbed().setTitle('🔓 PV désactivé')
          .setDescription(fmtLine('➡️', `PV désactivé pour **${voice.name}** (${voice}).`));
        await logAction(client, data, message.guild, `PV OFF sur ${voice}`);
        return message.reply({ embeds: [e] });
      } else {
        data.pv.enabledChannels.push(voiceId);
        data.pv.owners[voiceId] = message.author.id;
        data.pv.access[voiceId] = [];
        await persist(data, message);
        const e = baseEmbed().setTitle('🔒 PV activé')
          .setDescription([
            fmtLine('👑', `Propriétaire : <@${message.author.id}>`),
            fmtLine('🎧', `Salon : **${voice.name}** (${voice})`),
            fmtLine('➕', `Ajoute des accès via \`=access @user\` **dans** ce salon.`)
          ].join('\n'));
        await logAction(client, data, message.guild, `PV ON sur ${voice} (owner ${message.member})`);
        return message.reply({ embeds: [e] });
      }
    }

    /* ---------------- PV ACCESS ---------------- */
    case 'acc': {
      const authorCh = message.member.voice.channel;
      if (!authorCh) {
        const e = baseEmbed().setTitle('🗣️ Pas en vocal').setDescription(fmtLine('🎧', 'Tu dois être **dans** le salon PV pour utiliser `=acc`.'));
        return message.reply({ embeds: [e] });
      }
      const isPv = data.pv.enabledChannels.includes(authorCh.id);
      if (!isPv) {
        const e = baseEmbed().setTitle('🔓 Pas un PV').setDescription(fmtLine('🔎', 'Ce salon n\'est pas en mode PV.'));
        return message.reply({ embeds: [e] });
      }
      const ownerId = data.pv.owners[authorCh.id];
      if (ownerId !== message.author.id) {
        const e = baseEmbed().setTitle('⛔ Refusé').setDescription(fmtLine('👑', 'Seul le **propriétaire** du PV peut gérer les accès.'));
        return message.reply({ embeds: [e] });
      }
      const targetId = userToId(args[0]);
      if (!targetId) {
        const e = baseEmbed().setTitle('❓ Cible invalide').setDescription(fmtLine('🧾', 'Utilise `=acc <@user|ID>`.'));
        return message.reply({ embeds: [e] });
      }
      const list = data.pv.access[authorCh.id] || [];
      const idx = list.indexOf(targetId);
      if (idx >= 0) list.splice(idx, 1); else list.push(targetId);
      data.pv.access[authorCh.id] = list;
      await persist(data, message);
      const e = baseEmbed().setTitle('🧾 Accès PV mis à jour')
        .setDescription(fmtLine(idx >= 0 ? '➖' : '➕', `${idx >= 0 ? 'Retiré' : 'Ajouté'} : <@${targetId}>`));
      await logAction(client, data, message.guild, `PV access ${idx>=0?'REMOVE':'ADD'} ${targetId} sur ${authorCh} par ${message.member}`);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- PV DELETE ---------------- */
    case 'pvdelete': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé à SYS/SYS+.');
      }
      data.pv.enabledChannels = [];
      data.pv.owners = {};
      data.pv.access = {};
      await persist(data, message);
      const e = baseEmbed().setTitle('🧹 PV supprimés').setDescription(fmtLine('🗑️', 'Tous les PV ont été supprimés (catlock inchangé).'));
      await logAction(client, data, message.guild, `PV DELETE par ${message.member}`);
      return message.reply({ embeds: [e] });
    }

    /* ---------------- PV LIST ---------------- */
    case 'pvlist': {
      if (!requireLevels(access, ['SYS','OWNER', 'WL'])) {
        return replyNoPerms(message, 'Réservé à Owner & Sys.');
      }
      const channels = data.pv.enabledChannels
        .map(id => message.guild.channels.cache.get(id))
        .filter(Boolean);
      const sorted = sortChannelsByCategoryThenName(channels);
      const lines = [];
      for (const ch of sorted) {
        const ownerId = data.pv.owners[ch.id];
        const ownerDisplay = ownerId ? `<@${ownerId}> 〡 \`${ownerId}\`` : `Inconnu ID: \`${ownerId ?? 'N/A'}\``;
        const accessList = (data.pv.access[ch.id] || []).filter(id => id !== ownerId);
        const accessDisplay = accessList.length ? accessList.map(id => `<@${id}>`).join(', ') : 'Aucun';
        lines.push([
          fmtLine('🎧', `**Salon** : <#${ch.id}> 〡 Nom : \`${ch.name}\``),
          fmtLine('👑', `**Propriétaire** : ${ownerDisplay}`),
          fmtLine('🧾', `**Accès** : ${accessDisplay}`),
          '‎'
        ].join('\n'));
      }
      const e = baseEmbed().setTitle('📜 Salons PV')
        .setDescription(lines.length ? lines.join('\n') : fmtLine('🗒️', 'Aucun PV configuré.'));
      return message.reply({ embeds: [e] });
    }


    /* ---------------- PVINFO ---------------- */
    case 'pvinfo': {
      if (!requireLevels(access, ['OWNER'])) {
        return replyNoPerms(message, 'Réservé aux Owner.');
      }

      const userPvs = Object.entries(data.pv || {})
  .filter(([chId, info]) => 
    info.owner === userId || info.allowed?.includes(userId)
  );


      if (!userPvs.length) {
        const e = baseEmbed()
          .setTitle('📭 Aucun PV')
          .setDescription(fmtLine('🛑', 'Tu n\'es propriétaire d\'aucun PV.'));
        return message.reply({ embeds: [e] });
      }

      const desc = userPvs.map(([chId, info], i) => {
        const ch = message.guild.channels.cache.get(chId);
        return [
          `**${i + 1}.** ${ch ? `${ch} \`${ch.name}\`` : `❓ Inconnu (\`${chId}\`)`}`,
          fmtLine('👑', `<@${info.owner}>`),
          fmtLine('👥', info.allowed?.length ? info.allowed.map(u => `<@${u}>`).join(', ') : 'Aucun'),
        ].join('\n');
      }).join('\n\n');

      const e = baseEmbed()
        .setTitle('🔒 Tes PV actifs')
        .setDescription(desc);
      return message.reply({ embeds: [e] });
    }


    /* ---------------- CATLOCK ---------------- */
    case 'catlock': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé à SYS/SYS+.');
      }
      const catId = channelToId(args[0]);
      if (!catId) {
        const e = baseEmbed().setTitle('❓ Catégorie invalide').setDescription(fmtLine('🧭', 'Utilise `=catlock <categoryId>`.'));
        return message.reply({ embeds: [e] });
      }
      const cat = message.guild.channels.cache.get(catId);
      if (!cat || cat.type !== ChannelType.GuildCategory) {
        const e = baseEmbed().setTitle('🧭 Catégorie invalide').setDescription(fmtLine('🔎', 'ID de catégorie invalide.'));
        return message.reply({ embeds: [e] });
      }
      const idx = data.catlock.categories.indexOf(catId);
      if (idx >= 0) {
        data.catlock.categories.splice(idx, 1);
        await persist(data, message);
        const e = baseEmbed().setTitle('🚪 Catlock désactivé')
          .setDescription(fmtLine('↩️', `Catlock retiré pour **${cat.name}**.`));
        await logAction(client, data, message.guild, `CATLOCK OFF sur ${cat.name}`);
        return message.reply({ embeds: [e] });
      } else {
        data.catlock.categories.push(catId);
        await persist(data, message);
        const e = baseEmbed().setTitle('🚪 Catlock activé')
          .setDescription(fmtLine('🔐', `Seuls les **WL** peuvent rester dans les vocaux de **${cat.name}**.`));
        await logAction(client, data, message.guild, `CATLOCK ON sur ${cat.name}`);
        return message.reply({ embeds: [e] });
      }
    }

    /* ---------------- SETUP ROLES ---------------- */
    case 'setup': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé à SYS/SYS+.');
      }

      const sub = (args[0] || '').toLowerCase();

      if (!sub) {
        const embed = baseEmbed()
          .setTitle('🧩 Configuration des rôles (Setup)')
          .setDescription([
            '*Voici les rôles qui peuvent utiliser certaines commandes :*',
            '',
            `**\`🔎\` Find** : \n${data.setupRoles?.find?.length ? data.setupRoles.find.map(id => `<@&${id}> — \`${id}\``).join('\n') : 'Aucun'}`,
            ``,
            `**\`🧲\` MV** : \n${data.setupRoles?.mv?.length ? data.setupRoles.mv.map(id => `<@&${id}> — \`${id}\``).join('\n') : 'Aucun'}`,
            ``,
            `**\`🤝\` Join** : \n${data.setupRoles?.join?.length ? data.setupRoles.join.map(id => `<@&${id}> — \`${id}\``).join('\n') : 'Aucun'}`,
            ``,
            `**\`🌐\` ALL** : \n${data.setupRoles?.all?.length ? data.setupRoles.all.map(id => `<@&${id}> — \`${id}\``).join('\n') : 'Aucun'}`
          ].join('\n'));
        return message.reply({ embeds: [embed] });
      }

      if (!['find', 'mv', 'join', 'all'].includes(sub)) {
        const e = baseEmbed()
          .setTitle('❓ Sous-commande invalide')
          .setDescription(fmtLine('🧭', 'Utilise `=setup <find|mv|join|all> <@Role...>`.'));
        return message.reply({ embeds: [e] });
      }

      const roleIds = args.slice(1)
        .map(x => x.replace(/[<@&>]/g, ''))
        .filter(id => isValidSnowflake(id));

      if (roleIds.length === 0) {
        const e = baseEmbed()
          .setTitle('❓ Rôle manquant')
          .setDescription(fmtLine('🧭', 'Utilise `=setup <find|mv|join|all> <@Role...>`.'));
        return message.reply({ embeds: [e] });
      }

      data.setupRoles = data.setupRoles || {};
      if (!data.setupRoles.find) data.setupRoles.find = [];
      if (!data.setupRoles.mv) data.setupRoles.mv = [];
      if (!data.setupRoles.join) data.setupRoles.join = [];
      if (!data.setupRoles.all) data.setupRoles.all = [];

      const updated = [];
      if (sub === 'all') {
        const existing = data.setupRoles.all;
        for (const roleId of roleIds) {
          const idx = existing.indexOf(roleId);
          if (idx >= 0) { existing.splice(idx, 1); updated.push(`➖ Retiré de ALL : <@&${roleId}>`); }
          else { existing.push(roleId); updated.push(`➕ Ajouté à ALL : <@&${roleId}>`); }
        }
      } else {
        const existing = data.setupRoles[sub];
        for (const roleId of roleIds) {
          const idx = existing.indexOf(roleId);
          if (idx >= 0) { existing.splice(idx, 1); updated.push(`➖ Retiré de ${sub.toUpperCase()} : <@&${roleId}>`); }
          else { existing.push(roleId); updated.push(`➕ Ajouté à ${sub.toUpperCase()} : <@&${roleId}>`); }
        }
      }

      await persist(data, message);
      const embed = baseEmbed().setTitle('✅ Configuration mise à jour').setDescription(updated.join('\n'));
      return message.reply({ embeds: [embed] });
    }

    /* ---------------- SETLOGS ---------------- */
    case 'setlogs': {
      if (!requireLevels(access, ['SYS'])) {
        return replyNoPerms(message, 'Réservé à SYS/SYS+.');
      }
      const id = channelToId(args[0]);
      if (!id) {
        const e = baseEmbed().setTitle('❓ Salon invalide').setDescription(fmtLine('🪵', 'Utilise `=setlogs <#salon|ID>`.'));
        return message.reply({ embeds: [e] });
      }
      const ch = message.guild.channels.cache.get(id);
      if (!ch) {
        const e = baseEmbed().setTitle('🙈 Introuvable').setDescription(fmtLine('🧭', 'Salon introuvable.'));
        return message.reply({ embeds: [e] });
      }
      data.logChannelId = id;
      await persist(data, message);
      const e = baseEmbed().setTitle('🪵 Logs configurés')
        .setDescription(fmtLine('📍', `Les logs seront envoyés dans ${ch}.`));
      return message.reply({ embeds: [e] });
    }

    /* ---------------- VC COUNT & Stats---------------- */
    case 'vc': {
      const server = message.guild.name;
      const allVoiceChannels = getAllGuildVoiceChannels(message.guild);
      let totalMembers = 0;
      for (const ch of allVoiceChannels.values()) {
        totalMembers += ch.members.size;
      }
      const text = [`> 📊  **Il y a actuellement __${totalMembers}__ membres en vocal sur ${server} !**`].join('\n');
      return message.reply(text);
    }

        /* ---------------- STATS ---------------- */
      case 'stats': {
  const guild = message.guild;

  // Total membres
  const totalMembers = guild.memberCount;

  // Membres connectés (en ligne, DND ou idle)
  const onlineCount = guild.members.cache.filter(
    m => m.presence?.status && m.presence.status !== 'offline'
  ).size;

  // En vocal
  const voiceMembers = getAllGuildVoiceChannels(guild)
    .reduce((acc, ch) => acc + ch.members.size, 0);

  // Boosts
  const boosts = guild.premiumSubscriptionCount || 0;

  // Embed
  const embed = new EmbedBuilder()
    .setTitle(`L'Auberge \<:Auberge:1413563156302921778> — Statistiques`)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
    .setColor(0xFF4500)
    .setDescription([
      fmtLine('👥', `**Membres :** ${totalMembers}`),
      fmtLine('🟢', `**Connectés :** ${onlineCount}`),
      fmtLine('🎧', `**En vocal :** ${voiceMembers}`),
      fmtLine('🚀', `**Boosts :** ${boosts}`)
    ].join('\n'))
    .setFooter({ text: `Voice Manager ©` });

  return message.reply({ embeds: [embed] });
}



    /* ---------------- PANEL ---------------- */
    case 'panel': {
      const access = userHasCommandAccess(message.member, data, cmd);
      if (!requireLevels(access, ['SYS+'])) return replyNoPerms(message, 'Commande réservée à SYS+');
      ensureProtectDefaults(data);

      const p = data.protect;
      const lines = [
    `## 🛡️ Protection vocale`,

    `### 🚪 ▸ Deconnexion :
\`⚪\` État   ▸ ${p.enabled.DECO === "true" ? '**Activé**' : '**Désactivé**'}
\`⌚\` Temps ▸ **${p.window.DECO} Minutes**
\`📊\` Limite ▸ **${p.limit.DECO} Personnes**`,

    `### 🔇 ▸ Mute :
\`⚪\` État   ▸ ${p.enabled.MUTE === "true" ? '**Activé**' : '**Désactivé**'}
\`⌚\` Temps ▸ **${p.window.MUTE} Minutes**
\`📊\` Limite ▸ **${p.limit.MUTE} Personnes**`,

    `### 🔀 ▸ Move :
\`⚪\` État   ▸ ${p.enabled.MOVE === "true" ? '**Activé**' : '**Désactivé**'}
\`⌚\` Temps ▸ **${p.window.MOVE} Minutes**
\`📊\` Limite ▸ **${p.limit.MOVE} Personnes**`
  ].join('\n\n');

      const embed = baseEmbed()
        .setDescription(lines)
        .setColor(0x000000);

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_cfg_DECO').setLabel('🚪 Deconnexion').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_cfg_MUTE').setLabel('🔇 Mute').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('panel_cfg_MOVE').setLabel('🔁 Moove').setStyle(ButtonStyle.Secondary),
      );

      return message.channel.send({ embeds: [embed], components: [row1] });
    }

    /* ---------------- ALLOWLISTS ---------------- */
case 'validmute':
case 'validdeco':
case 'validmoov': {
  ensureProtectDefaults(data);
  const sub = cmd === 'validmute' ? 'MUTE' : (cmd === 'validdeco' ? 'DECO' : 'MOVE');
  const access2 = userHasCommandAccess(message.member, data, cmd);
  if (!requireLevels(access2, ['SYS','SYS+'])) return replyNoPerms(message);

  const arr = data.protect.valid[sub];
  const arg = args[0];

  if (!arg) {
    const list = arr.length ? arr.map(id => `<@${id}>`).join(', ') : '_Aucun_';
    const e = baseEmbed()
      .setTitle(`✅ Autorisés ${sub}`)
      .setDescription(list)
      .setColor(0x2f3136);
    return message.reply({ embeds: [e] });
  }

  const id = userToId(arg);
  if (!id) {
    const e = baseEmbed().setDescription('❌ Utilisateur invalide.');
    return message.reply({ embeds: [e] });
  }

  const i = arr.indexOf(id);
  let msg;
  if (i === -1) {
    arr.push(id);
    msg = `➕ <@${id}> ajouté à **${sub}**`;
  } else {
    arr.splice(i, 1);
    msg = `➖ <@${id}> retiré de **${sub}**`;
  }
  
  await persist(data, message);
  await logAction(client, data, message.guild, `Allowlist ${sub} mise à jour par ${message.author}: ${msg}`);

  const e = baseEmbed().setDescription(msg);
  return message.reply({ embeds: [e] });
}

/* ---------------- FOLLOW/LAISSE ---------------- */
case 'follow': {
  ensureProtectDefaults(data);
  const access2 = userHasCommandAccess(message.member, data, cmd);
  if (!requireLevels(access2, ['OWNER','SYS','SYS+'])) return replyNoPerms(message);

  const targetId = userToId(args[0] || '');
  if (!targetId) {
    const e = baseEmbed().setTitle('🐾 Follow').setDescription('❌ Cible invalide.');
    return message.reply({ embeds: [e] });
  }

  const expiresAt = Date.now() + 30 * 60 * 1000;
  data.follow[message.author.id] = { targetId, expiresAt };
  await persist(data, message);

  try {
    const user = await message.client.users.fetch(targetId);
    await user.send(`👀 On te suit 30m (par ${message.author.tag}).`);
  } catch {}

  const e = baseEmbed()
    .setTitle('✅ Suivi activé')
    .setDescription(`Tu suivras <@${targetId}> pendant 30 minutes.\nFait \`=unfollow\` pour arrêter de suivre la personne.`);
  return message.reply({ embeds: [e] });
}

case 'unfollow': {
  ensureProtectDefaults(data);
  const access2 = userHasCommandAccess(message.member, data, cmd);
  if (!requireLevels(access2, ['OWNER','SYS','SYS+'])) return replyNoPerms(message);

  const entry = data.follow[message.author.id];
  if (!entry) {
    const e = baseEmbed().setTitle('🐾 Follow').setDescription('ℹ️ Aucun suivi actif.');
    return message.reply({ embeds: [e] });
  }

  delete data.follow[message.author.id];
  await persist(data, message);

  try {
    const u = await message.client.users.fetch(entry.targetId);
    await u.send(`✅ Fin du follow (par ${message.author.tag}).`);
  } catch {}

  const e = baseEmbed().setTitle('🐾 Follow').setDescription('✅ Follow arrêté.');
  return message.reply({ embeds: [e] });
}

case 'laisse': {
  ensureProtectDefaults(data);
  const access2 = userHasCommandAccess(message.member, data, cmd);
  if (!requireLevels(access2, ['OWNER','SYS','SYS+'])) return replyNoPerms(message);

  const targetId = userToId(args[0] || '');
  if (!targetId) {
    const e = baseEmbed().setTitle('🐕 Laisse').setDescription('❌ Cible invalide.');
    return message.reply({ embeds: [e] });
  }

  const expiresAt = Date.now() + 30 * 60 * 1000;
  data.laisse[targetId] = { ownerId: message.author.id, expiresAt };
  await persist(data, message);

  try {
    const user = await message.client.users.fetch(targetId);
    await user.send(`🔗 Laisse activée 30m (par ${message.author.tag}).`);
  } catch {}

  const e = baseEmbed()
    .setTitle('✅ Laisse posée')
    .setDescription(`Sur <@${targetId}> pour 30 minutes.\nFait \`=unlaisse\` pour que la personne arrête de vous suivre.`);
  return message.reply({ embeds: [e] });
}

case 'unlaisse': {
  ensureProtectDefaults(data);
  const access2 = userHasCommandAccess(message.member, data, cmd);
  if (!requireLevels(access2, ['OWNER','SYS','SYS+'])) return replyNoPerms(message);

  const targetId = userToId(args[0] || '');
  if (!targetId) {
    const e = baseEmbed().setTitle('🐕 Laisse').setDescription('❌ Cible invalide.');
    return message.reply({ embeds: [e] });
  }

  const entry = data.laisse[targetId];
  if (!entry) {
    const e = baseEmbed().setTitle('🐕 Laisse').setDescription('ℹ️ Aucune laisse sur cette cible.');
    return message.reply({ embeds: [e] });
  }

  const isOwnerGlobal = data.owner.includes(message.author.id);
  if (entry.ownerId !== message.author.id && !isOwnerGlobal) {
    return replyNoPerms(message, "Seul l'auteur de la laisse ou un Sys peut la retirer.");
  }

  delete data.laisse[targetId];
  await persist(data, message);

  try {
    const user = await message.client.users.fetch(targetId);
    await user.send(`✅ Laisse retirée.`);
  } catch {}

  const e = baseEmbed().setTitle('🐕 Laisse').setDescription(`✅ Laisse retirée pour <@${targetId}>.`);
  return message.reply({ embeds: [e] });
}

case 'fldelete': {
  ensureProtectDefaults(data);
  const access2 = userHasCommandAccess(message.member, data, cmd);
  if (!requireLevels(access2, ['SYS+'])) return replyNoPerms(message, 'Réservé SYS+');

  data.follow = {};
  data.laisse = {};
  await persist(data, message);

  const e = baseEmbed().setTitle('🐕 Laisse').setDescription('🗑️ Tous les follow/laisse ont été supprimés.');
  return message.reply({ embeds: [e] });
}


    /* ---------------- DEFAULT ---------------- */
    default:
      break;
  }
}
