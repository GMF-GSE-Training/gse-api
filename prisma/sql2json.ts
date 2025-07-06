import * as fs from 'fs';
import * as path from 'path';

console.log('--- Starting sql2json.ts ---');

const sqlPath = path.join(__dirname, '..', '..', 'projek_sertifikat_db.sql');
console.log(`Reading SQL dump from: ${sqlPath}`);
if (!fs.existsSync(sqlPath)) {
  console.error('❌ SQL dump file not found!');
  process.exit(1);
}
const dump = fs.readFileSync(sqlPath, 'utf8');
console.log('✔ SQL dump read successfully.');

function copyBlock(table: string) {
  console.log(`\n--- Parsing table: ${table} ---`);
  // Regex for COPY block, tolerant to CRLF (\r\n) line endings
  const regex = new RegExp(`^COPY public\\.${table} \\(([^)]+)\\) FROM stdin;\\r?\\n([\\s\\S]*?)\\r?\\n\\\\\\.$`, 'm');
  const match = dump.match(regex);
  
  if (!match) {
    console.warn(`- WARNING: COPY block for table '${table}' not found.`);
    return { cols: [], lines: [] };
  }
  
  const [, colsStr, data] = match;
  const cols = colsStr.split(', ').map((c) => c.trim().replace(/"/g, ''));
  const lines = data.split('\n').filter(l => l); // Filter out empty lines
  
  console.log(`✔ Found COPY block for '${table}'. Columns: ${cols.length}, Lines: ${lines.length}`);
  return { cols, lines };
}

function parse(table: string) {
  const { cols, lines } = copyBlock(table);
  if (lines.length === 0) return [];

  // Filter out lines that are clearly not data rows (e.g. comments, COPY headers)
  const validLines = lines.filter((l) => {
    if (!l.includes('\t')) return false;
    const parts = l.split('\t');
    return parts.length === cols.length; // ensure column count matches
  });
  
  return validLines.map((l) => {
    const vals = l.split('\t');
    const obj: any = {};
    cols.forEach((c, i) => {
      obj[c] = vals[i] === '\\N' ? null : vals[i];
    });
    return obj;
  });
}

const outDir = path.join(__dirname, 'dummy-data');
console.log(`\n--- Writing JSON files to: ${outDir} ---`);
fs.mkdirSync(outDir, { recursive: true });

const tableMap: Record<string,string> = {
  participants: 'participants',
  users: 'users',
  roles: 'roles',
  capabilities: 'capabilities',
  capability_cots: 'capabilitycots',
  participant_cot: 'participantscot',
  curriculum_syllabus: 'curriculumsyllabus',
  cots: 'cots',
  certificates: 'certificates',
  signatures: 'signatures',
};

Object.entries(tableMap).forEach(([dumpName, fileName]) => {
  const data = parse(dumpName);
  fs.writeFileSync(path.join(outDir, `${fileName}.json`), JSON.stringify(data, null, 2));
  console.log(`✔ Wrote ${fileName}.json (${data.length} records)`);
});

// --- End of extraction ---

// Roles – if not present in dump, use defaults
const rolesDataDump = parse('roles');
let rolesArray: any[] = rolesDataDump;
if (rolesArray.length === 0) {
  rolesArray = ['super admin', 'supervisor', 'lcu', 'user'];
}
fs.writeFileSync(path.join(outDir, 'roles.json'), JSON.stringify(rolesArray, null, 2));
console.log(`✔ Wrote roles.json (${rolesArray.length} records)`);

console.log('\n--- ✅ SQL to JSON conversion finished successfully! ---');
