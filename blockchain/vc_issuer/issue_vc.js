/**
 * PhantomID — W3C Verifiable Credential Issuer
 * =============================================
 * Called as a subprocess by proof_service.py.
 *
 * Interface (stdio):
 *   stdin  → JSON string with keys:
 *              user_pseudonym, ipfs_cid, solana_tx_sig,
 *              risk_level, detection_timestamp
 *   stdout → JSON-serialized signed W3C VC (IdentityThreatCredential)
 *   stderr → error message on failure (exit code 1)
 *
 * W3C VC spec: https://www.w3.org/TR/vc-data-model/
 * Library: @digitalbazaar/vc ^6.x
 */

import { issue, verifyCredential } from '@digitalbazaar/vc';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { loadKeyFromEnvOrGenerate } from './key_manager.js';

// ── DocumentLoader (minimal — resolve only the VC context) ──────────────────
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const credentialsContext = require('credentials-context');
const ed25519Context = require('ed25519-signature-2020-context');

const CONTEXT_MAP = {
  [credentialsContext.constants.CONTEXT_URL]: credentialsContext.CONTEXT,
  [ed25519Context.constants.CONTEXT_URL]: ed25519Context.CONTEXT,
};

let issuerPublicKeyDoc = null;

async function documentLoader(url) {
  if (CONTEXT_MAP[url]) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: CONTEXT_MAP[url],
    };
  }
  if (url.startsWith('did:key:') && issuerPublicKeyDoc) {
    return {
      contextUrl: null,
      documentUrl: url,
      document: issuerPublicKeyDoc,
    };
  }
  // Try default resolution for others if any
  throw new Error(`Unsupported context URL in documentLoader: ${url}`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Read payload from stdin
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const rawInput = Buffer.concat(chunks).toString('utf8').trim();

  let payload;
  try {
    payload = JSON.parse(rawInput);
  } catch (err) {
    process.stderr.write(`Failed to parse stdin JSON: ${err.message}\n`);
    process.exit(1);
  }

  const {
    user_pseudonym,
    ipfs_cid,
    solana_tx_sig,
    risk_level,
    detection_timestamp,
  } = payload;

  if (!user_pseudonym || !ipfs_cid || !solana_tx_sig || !risk_level || !detection_timestamp) {
    process.stderr.write('Missing required fields in input payload\n');
    process.exit(1);
  }

  // 2. Load (or generate) the issuer keypair
  let keyPair;
  try {
    keyPair = await loadKeyFromEnvOrGenerate();
  } catch (err) {
    process.stderr.write(`Key load error: ${err.message}\n`);
    process.exit(1);
  }

  const fingerprint = keyPair.fingerprint();
  const issuerDid = `did:key:${fingerprint}`;
  const verificationMethod = `${issuerDid}#${fingerprint}`;
  keyPair.id = verificationMethod;
  keyPair.controller = issuerDid;
  
  issuerPublicKeyDoc = Object.assign(
    {
      '@context': [
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: issuerDid,
      assertionMethod: [verificationMethod],
      authentication: [verificationMethod],
      capabilityInvocation: [verificationMethod],
      capabilityDelegation: [verificationMethod],
      keyAgreement: []
    },
    await keyPair.export({ publicKey: true })
  );

  // 3. Build the unsigned credential
  const issuanceDate = new Date().toISOString();
  const credential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/ed25519-2020/v1',
      {
        'IdentityThreatCredential': 'https://phantom.id/vocab#IdentityThreatCredential',
        'threatDetected': 'https://phantom.id/vocab#threatDetected',
        'evidenceCid': 'https://phantom.id/vocab#evidenceCid',
        'onChainTx': 'https://phantom.id/vocab#onChainTx',
        'riskLevel': 'https://phantom.id/vocab#riskLevel',
        'detectionTimestamp': 'https://phantom.id/vocab#detectionTimestamp'
      }
    ],
    type: ['VerifiableCredential', 'IdentityThreatCredential'],
    issuer: issuerDid,
    issuanceDate,
    credentialSubject: {
      id: `did:phantom:${user_pseudonym}`,
      threatDetected: true,
      evidenceCid: ipfs_cid,
      onChainTx: solana_tx_sig,
      riskLevel: risk_level,
      detectionTimestamp: detection_timestamp,
    },
  };

  // 4. Create the Ed25519Signature2020 suite
  const suite = new Ed25519Signature2020({
    key: keyPair,
  });

  // 5. Issue (sign) the credential
  let verifiableCredential;
  try {
    verifiableCredential = await issue({
      credential,
      suite,
      documentLoader,
    });
  } catch (err) {
    process.stderr.write(`VC issuance failed: ${err.message}\n${err.stack}\n`);
    process.exit(1);
  }

  // 6. Emit the signed VC to stdout
  process.stdout.write(JSON.stringify(verifiableCredential, null, 2));
}

main().catch((err) => {
  process.stderr.write(`Unhandled error: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
