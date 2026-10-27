// Restore only the clips used by Mova. Licensed videos are not redistributed in the public source repository.
// Source and conditions: https://vitalanimations.com/free-pack / https://vitalanimations.com/license
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const manifest = require('./exercise-media-manifest.json');
const destination = path.resolve(__dirname, '../assets/exercise-hd');
const hash = (data) => crypto.createHash('sha256').update(data).digest('hex');
async function range(start, end) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(manifest.source, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(45000) });
      const expected = `bytes ${start}-${end}/${manifest.archiveSize}`;
      if (response.status !== 206 || response.headers.get('content-range') !== expected) {
        await response.body?.cancel();
        throw Error('The official archive changed or the server does not support partial downloads.');
      }
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length !== end - start + 1) throw Error('Incomplete media download.');
      return data;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }
}
async function restore(clip) {
  const target = path.join(destination, clip.file);
  try { if (hash(await fs.readFile(target)) === clip.sha256) return false; } catch { /* New checkout. */ }
  const header = await range(clip.offset, clip.offset + 29);
  if (header.readUInt32LE(0) !== 0x04034b50) throw Error('Invalid archive header.');
  const start = clip.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  const compressed = await range(start, start + clip.compressed - 1);
  const data = clip.method === 8 ? zlib.inflateRawSync(compressed, { maxOutputLength: clip.size }) : compressed;
  if (data.length !== clip.size || hash(data) !== clip.sha256) throw Error('Media verification failed for ' + clip.file);
  await fs.writeFile(target, data);
  console.log('Restored exercise clip ' + clip.file);
  return true;
}
async function main() {
  await fs.mkdir(destination, { recursive: true });
  let restored = 0;
  for (let i = 0; i < manifest.clips.length; i += 2) {
    const results = await Promise.all(manifest.clips.slice(i, i + 2).map(restore));
    restored += results.filter(Boolean).length;
  }
  console.log(`Exercise media ready: ${manifest.clips.length} verified clips (${restored} downloaded).`);
}
if (require.main === module) main().catch((error) => { console.error('Exercise media unavailable: ' + error.message + '\nRetry with npm run media:prepare.'); process.exitCode = 1; });
module.exports = { hash, restore, range };
