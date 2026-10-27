/**
 * Generates the RSA key pair used to sign (private key) and validate (public
 * key) JWTs. Both services must only ever hold the public key:
 *
 *   - Auth service: signs tokens with ../../keys/jwt-private.pem
 *   - Repairs service (later): validates with   ../../keys/jwt-public.pem
 *
 * The files are git-ignored (*.pem + keys/*), so they must be generated
 * locally or inside the container before the services start.
 */
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '..', '..');
const keysDir = path.join(repoRoot, 'keys');
const privateKeyPath = path.join(keysDir, 'jwt-private.pem');
const publicKeyPath = path.join(keysDir, 'jwt-public.pem');

const shouldForce = process.argv.includes('--force');

if (existsSync(privateKeyPath) && existsSync(publicKeyPath) && !shouldForce) {
  console.log('RSA key pair already exists at', keysDir);
  process.exit(0);
}

mkdirSync(keysDir, { recursive: true });

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privateKeyPath, privateKey);
writeFileSync(publicKeyPath, publicKey);
chmodSync(privateKeyPath, 0o600);
chmodSync(publicKeyPath, 0o644);

console.log(`RSA key pair generated at ${keysDir}`);
