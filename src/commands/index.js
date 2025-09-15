import { catlock } from './catlock.js';
import { autoacc } from './autoacc.js';
import { wall } from './wall.js';
import { pvinfo } from './pvinfo.js';
import { wmv } from './wmv.js';
import { wdc } from './wdc.js';
import { wmt } from './wmt.js';
import { help } from './help.js';
import { helpall } from './helpall.js';
import { pv } from './pv.js';
import { wl } from './wl.js';
import { sys } from './sys.js';
import { owner } from './owner.js';
import { panel } from './panel.js';
import { follow } from './follow.js';
import { laisse } from './laisse.js';
import { wakeup } from './wakeup.js';

const commands = {
  catlock,
  autoacc,
  wall,
  pvinfo,
  wmv,
  wdc,
  wmt,
  help,
  helpall,
  pv,
  wl,
  sys,
  owner,
  panel,
  follow,
  laisse,
  wakeup,
  // Aliases pour compatibilité
  validmoov: wmv,
  validdeco: wdc,
  validmute: wmt
};

export async function handleCommand(client, message, data, prefix) {
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  
  const command = commands[commandName];
  if (command) {
    await command(client, message, args, data);
  }
}