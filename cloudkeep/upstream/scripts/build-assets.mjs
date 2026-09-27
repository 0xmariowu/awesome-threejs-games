import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const binary = process.env.BLENDER_BIN || (process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : 'blender');
const script = fileURLToPath(new URL('./build_assets.py', import.meta.url));
const result = spawnSync(binary, ['--background', '--python-exit-code', '1', '--python', script], { stdio: 'inherit' });
if (result.error) {
  console.error('Blender could not start. Set BLENDER_BIN to your Blender executable.');
  console.error(result.error.message);
}
process.exit(result.status ?? 1);
