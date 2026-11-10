import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const packagePath = new URL('../package.json', import.meta.url);
const lockPath = new URL('../package-lock.json', import.meta.url);

if (existsSync(lockPath)) {
  throw new Error('O lockfile já existe. A preparação inicial não deve substituir uma resolução versionada.');
}

const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
const exactVersion = /^\d+\.\d+\.\d+$/;

function metadata(name, version) {
  const result = JSON.parse(execFileSync(npm, [
    'view', `${name}@${version}`, '--json', '--registry=https://registry.npmjs.org/',
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }));
  if (result.name !== name || result.version !== version) {
    throw new Error(`Metadados inesperados para ${name}@${version}.`);
  }
  return result;
}

function declaredVersion(name) {
  const version = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
  if (typeof version !== 'string' || !exactVersion.test(version)) {
    throw new Error(`${name} precisa ter uma versão exata para esta preparação.`);
  }
  return version;
}

function reportMetadata(data) {
  return {
    name: data.name,
    version: data.version,
    dependencies: data.dependencies,
    peerDependencies: data.peerDependencies,
    engines: data.engines,
    exports: data.exports,
    dist: data.dist,
  };
}

const plugin = metadata('@tanstack/router-plugin', declaredVersion('@tanstack/router-plugin'));
const router = metadata('@tanstack/react-router', declaredVersion('@tanstack/react-router'));
const generatorRange = plugin.dependencies?.['@tanstack/router-generator'];

// Use somente a versão-base publicada pelo próprio plugin, não uma versão
// escolhida por igualdade com react-router ou por ser a versão mais recente.
const match = typeof generatorRange === 'string'
  ? generatorRange.match(/^[~^]?(\d+\.\d+\.\d+)$/)
  : null;
if (!match) {
  throw new Error(`Faixa do generator exige análise específica: ${generatorRange ?? 'ausente'}.`);
}
const generatorVersion = match[1];
const generator = metadata('@tanstack/router-generator', generatorVersion);

const report = {
  selection: {
    source: 'Dependência oficial de @tanstack/router-plugin',
    declaredRange: generatorRange,
    selectedGenerator: generatorVersion,
    status: 'Candidato pendente de instalação e build; não é confirmação de compatibilidade.',
  },
  plugin: reportMetadata(plugin),
  reactRouter: reportMetadata(router),
  generator: reportMetadata(generator),
};
writeFileSync('tanstack-metadata.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

if (manifest.dependencies?.['@tanstack/router-generator']) {
  throw new Error('Generator já declarado em dependencies; revise antes de alterar sua classificação.');
}
if (manifest.overrides?.['@tanstack/router-generator']) {
  throw new Error('Já existe um override do generator; revise antes de substituí-lo.');
}
manifest.devDependencies = {
  ...manifest.devDependencies,
  '@tanstack/router-generator': generatorVersion,
};
manifest.overrides = {
  ...manifest.overrides,
  '@tanstack/router-generator': '$@tanstack/router-generator',
};
writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

// O npm gera o lockfile real, com resoluções e integridades do registry.
// router-core não recebe um número presumido: sua resolução será registrada
// e validada junto às dependências e peers de react-router e do plugin.
execFileSync(npm, ['install', '--package-lock-only', '--strict-peer-deps'], {
  stdio: 'inherit',
});
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
if (lock.lockfileVersion !== 3 || !lock.packages?.['']) {
  throw new Error('O npm não produziu o lockfile esperado.');
}
const generators = Object.entries(lock.packages).filter(([path]) =>
  path.endsWith('node_modules/@tanstack/router-generator'),
);
if (!generators.length || generators.some(([, entry]) => entry.version !== generatorVersion)) {
  throw new Error('A resolução do generator não corresponde à versão selecionada.');
}
console.log('Lockfile gerado. A publicação depende de npm ci e de todas as verificações do build.');
