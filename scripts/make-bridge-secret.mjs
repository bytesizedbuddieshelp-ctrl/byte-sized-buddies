// Makes a new secret for the Gmail bridge. Run it in your own Terminal app: npm run bridge:secret
// It prints two things. The secret goes ONLY into Apps Script (Script Properties).
// The SQL line holds only a fingerprint (SHA-256 hash) of the secret, for the Supabase SQL Editor.
// Nothing is saved to a file. Do not run it inside a chat, so the secret never lands there.
import { createHash, randomBytes } from 'node:crypto';

const secret = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(secret).digest('hex');

console.log(`
1. In Apps Script, add a Script Property named BRIDGE_SECRET with this value:

${secret}

2. In the Supabase SQL Editor, run this line (it holds only the fingerprint, not the secret):

insert into public.bridge_secret (id, secret_hash) values (1, '${hash}') on conflict (id) do update set secret_hash = excluded.secret_hash;

Close this Terminal window when you are done. Running this again makes a new secret,
and the old one stops working until you update both places.
`);
