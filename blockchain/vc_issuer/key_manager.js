/**
 * PhantomID — Key Manager
 * =======================
 * Loads an Ed25519 keypair for the VC issuer.
 *
 * Priority:
 *   1. PHANTOMID_ISSUER_KEY_MULTIBASE env var (serialised multibase key)
 *   2. PHANTOMID_ISSUER_KEY_PATH env var      (path to JSON key file)
 *   3. Generates a fresh ephemeral key (logged as WARNING — not for prod)
 *
 * For the hackathon, option 3 is acceptable as long as the same key is used
 * throughout a demo session. For production, always set option 1 or 2.
 */

import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const EPHEMERAL_KEY_PATH = resolve(__dirname, '.ephemeral_key.json');

/**
 * Load or generate the issuer Ed25519 keypair.
 * @returns {Promise<Ed25519VerificationKey2020>}
 */
export async function loadKeyFromEnvOrGenerate() {
  // Option 1: multibase key in env
  const multibase = process.env.PHANTOMID_ISSUER_KEY_MULTIBASE;
  if (multibase) {
    process.stderr.write('[key_manager] Loading key from PHANTOMID_ISSUER_KEY_MULTIBASE\n');
    return Ed25519VerificationKey2020.from({ publicKeyMultibase: multibase });
  }

  // Option 2: path to JSON key file
  const keyPath = process.env.PHANTOMID_ISSUER_KEY_PATH;
  if (keyPath && existsSync(keyPath)) {
    process.stderr.write(`[key_manager] Loading key from ${keyPath}\n`);
    const raw = JSON.parse(readFileSync(keyPath, 'utf8'));
    return Ed25519VerificationKey2020.from(raw);
  }

  // Option 3: reuse ephemeral key from disk, or generate one
  if (existsSync(EPHEMERAL_KEY_PATH)) {
    process.stderr.write(
      `[key_manager] WARNING: Using persisted ephemeral key (${EPHEMERAL_KEY_PATH}). Not for production.\n`
    );
    const raw = JSON.parse(readFileSync(EPHEMERAL_KEY_PATH, 'utf8'));
    return Ed25519VerificationKey2020.from(raw);
  }

  process.stderr.write(
    '[key_manager] WARNING: Generating ephemeral Ed25519 keypair. ' +
    'Set PHANTOMID_ISSUER_KEY_PATH for stable identity.\n'
  );
  const key = await Ed25519VerificationKey2020.generate();
  const exported = await key.export({ publicKey: true, privateKey: true });
  writeFileSync(EPHEMERAL_KEY_PATH, JSON.stringify(exported, null, 2));
  return key;
}
