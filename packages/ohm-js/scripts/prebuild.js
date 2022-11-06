import fs from 'fs';

const {version} = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
fs.writeFileSync(
    './src/version.js',
    `// Generated by scripts/prebuild.js\nexport const version = '${version}';\n`,
);