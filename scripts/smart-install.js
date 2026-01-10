#!/usr/bin/env node
/**
 * Smart Install Script for claude-mem
 *
 * Uses mise to manage runtime dependencies (bun, python).
 * Auto-installs mise if missing, then installs required runtimes.
 * Also ensures viewer.html is built if missing.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

// Dynamically resolve ROOT from script location (works regardless of marketplace folder name)
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const MARKER = join(ROOT, '.install-version');
const IS_WINDOWS = process.platform === 'win32';

// Common installation paths for mise
const MISE_COMMON_PATHS = IS_WINDOWS
  ? [join(homedir(), '.local', 'bin', 'mise.exe')]
  : [join(homedir(), '.local', 'bin', 'mise'), '/usr/local/bin/mise', join(homedir(), '.mise', 'bin', 'mise')];

// Shims paths for mise-managed tools
const MISE_SHIMS_PATH = join(homedir(), '.local', 'share', 'mise', 'shims');

/**
 * Get the mise executable path
 */
function getMisePath() {
  // Try PATH first
  try {
    const result = spawnSync('mise', ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS
    });
    if (result.status === 0) return 'mise';
  } catch {
    // Not in PATH
  }

  // Check common installation paths
  return MISE_COMMON_PATHS.find(existsSync) || null;
}

/**
 * Check if mise is installed
 */
function isMiseInstalled() {
  return getMisePath() !== null;
}

/**
 * Get mise version if installed
 */
function getMiseVersion() {
  const misePath = getMisePath();
  if (!misePath) return null;

  try {
    const result = spawnSync(misePath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS
    });
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Install mise automatically
 */
function installMise() {
  console.error('🔧 mise not found. Installing mise...');

  try {
    if (IS_WINDOWS) {
      console.error('   Installing via PowerShell...');
      execSync('powershell -ExecutionPolicy ByPass -c "irm https://mise.run | iex"', {
        stdio: 'inherit',
        shell: true
      });
    } else {
      console.error('   Installing via curl...');
      execSync('curl https://mise.run | sh', {
        stdio: 'inherit',
        shell: true
      });
    }

    if (!isMiseInstalled()) {
      throw new Error(
        'mise installation completed but binary not found. ' +
        'Please restart your terminal and try again.'
      );
    }

    const version = getMiseVersion();
    console.error(`✅ mise ${version} installed successfully`);
  } catch (error) {
    console.error('❌ Failed to install mise');
    console.error('   Please install manually:');
    console.error('   - curl https://mise.run | sh');
    console.error('   - Or: brew install mise (macOS)');
    console.error('   Then restart your terminal and try again.');
    throw error;
  }
}

/**
 * Get executable path, checking both PATH and mise shims
 */
function getToolPath(tool) {
  // Try PATH first
  try {
    const result = spawnSync(tool, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS
    });
    if (result.status === 0) return tool;
  } catch {
    // Not in PATH
  }

  // Check mise shims
  const shimPath = IS_WINDOWS
    ? join(MISE_SHIMS_PATH, `${tool}.exe`)
    : join(MISE_SHIMS_PATH, tool);

  if (existsSync(shimPath)) return shimPath;

  // Check common paths for bun
  if (tool === 'bun') {
    const bunPaths = IS_WINDOWS
      ? [join(homedir(), '.bun', 'bin', 'bun.exe')]
      : [join(homedir(), '.bun', 'bin', 'bun'), '/usr/local/bin/bun'];
    const found = bunPaths.find(existsSync);
    if (found) return found;
  }

  return null;
}

/**
 * Get tool version
 */
function getToolVersion(tool) {
  const toolPath = getToolPath(tool);
  if (!toolPath) return null;

  try {
    const result = spawnSync(toolPath, ['--version'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: IS_WINDOWS
    });
    return result.status === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Install a tool using mise
 */
function installWithMise(tool, version = 'latest') {
  const misePath = getMisePath();
  if (!misePath) {
    throw new Error('mise not found');
  }

  console.error(`🔧 Installing ${tool} via mise...`);

  try {
    // Use mise use -g to install globally
    execSync(`${misePath} use -g ${tool}@${version}`, {
      stdio: 'inherit',
      shell: IS_WINDOWS
    });

    // Reshim to ensure shims are created
    execSync(`${misePath} reshim`, {
      stdio: 'inherit',
      shell: IS_WINDOWS
    });

    const installedVersion = getToolVersion(tool);
    if (installedVersion) {
      console.error(`✅ ${tool} ${installedVersion} installed successfully`);
    } else {
      console.error(`✅ ${tool} installed (version check pending PATH reload)`);
    }
  } catch (error) {
    console.error(`❌ Failed to install ${tool} via mise`);
    throw error;
  }
}

/**
 * Check if dependencies need to be installed
 */
function needsInstall() {
  if (!existsSync(join(ROOT, 'node_modules'))) return true;
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    const marker = JSON.parse(readFileSync(MARKER, 'utf-8'));
    return pkg.version !== marker.version || getToolVersion('bun') !== marker.bun;
  } catch {
    return true;
  }
}

/**
 * Check if viewer.html needs to be built
 * Handles both source directory (scripts/) and marketplace (plugin/scripts/) structures
 */
function needsViewerBuild() {
  // Check multiple possible locations
  const viewerPaths = [
    join(ROOT, 'ui', 'viewer.html'),           // marketplace structure: plugin/ui/viewer.html
    join(ROOT, 'plugin', 'ui', 'viewer.html'), // source structure: ./plugin/ui/viewer.html
  ];
  return !viewerPaths.some(existsSync);
}

/**
 * Install dependencies using Bun
 */
function installDeps() {
  const bunPath = getToolPath('bun');
  if (!bunPath) {
    throw new Error('Bun executable not found');
  }

  console.error('📦 Installing dependencies with Bun...');

  // Quote path for Windows paths with spaces
  const bunCmd = IS_WINDOWS && bunPath.includes(' ') ? `"${bunPath}"` : bunPath;

  execSync(`${bunCmd} install`, { cwd: ROOT, stdio: 'inherit', shell: IS_WINDOWS });

  // Write version marker
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
  writeFileSync(MARKER, JSON.stringify({
    version: pkg.version,
    bun: getToolVersion('bun'),
    python: getToolVersion('python'),
    mise: getMiseVersion(),
    installedAt: new Date().toISOString()
  }));
}

/**
 * Build viewer.html if source exists
 * Handles both source directory (scripts/) and marketplace (plugin/scripts/) structures
 */
function buildViewer() {
  // Try multiple possible build configurations
  const buildConfigs = [
    // Source directory structure: ROOT = project root, build from there
    {
      buildScript: join(ROOT, 'scripts', 'build-hooks.js'),
      srcViewer: join(ROOT, 'src', 'ui', 'viewer'),
      cwd: ROOT
    },
    // Marketplace structure: ROOT = plugin/, build from parent
    {
      buildScript: join(ROOT, '..', 'scripts', 'build-hooks.js'),
      srcViewer: join(ROOT, '..', 'src', 'ui', 'viewer'),
      cwd: join(ROOT, '..')
    }
  ];

  const config = buildConfigs.find(c => existsSync(c.buildScript) && existsSync(c.srcViewer));

  if (config) {
    console.error('🔨 Building viewer.html...');
    try {
      execSync('npm run build', {
        cwd: config.cwd,
        stdio: 'inherit',
        shell: IS_WINDOWS
      });
      console.error('✅ Viewer built successfully');
    } catch (error) {
      console.error('⚠️ Failed to build viewer:', error.message);
      // Don't throw - viewer is optional
    }
  } else {
    console.error('⚠️ viewer.html missing but build source not found');
    console.error('   This may indicate an incomplete plugin installation.');
  }
}

// Main execution
try {
  // Step 1: Ensure mise is installed
  if (!isMiseInstalled()) {
    installMise();
  }

  // Step 2: Ensure bun is installed via mise
  if (!getToolPath('bun')) {
    installWithMise('bun');
  }

  // Step 3: Ensure python is installed via mise (for Chroma/embeddings)
  if (!getToolPath('python')) {
    installWithMise('python', '3.13');
  }

  // Step 4: Install npm dependencies if needed
  if (needsInstall()) {
    installDeps();
    console.error('✅ Dependencies installed');
  }

  // Step 5: Build viewer if missing
  if (needsViewerBuild()) {
    buildViewer();
  }
} catch (e) {
  console.error('❌ Installation failed:', e.message);
  process.exit(1);
}
