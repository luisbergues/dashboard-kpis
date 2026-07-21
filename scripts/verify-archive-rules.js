#!/usr/bin/env node
// Simulates Firebase RTDB rule evaluation for the archive/archive_lock rules
// added in database.rules.json, against a small fake `users` tree. There is
// no Firebase emulator installed in this environment; this script mirrors
// the exact expression this project's rules use (auth != null &&
// root.child('users').child(auth.uid).child(<field>).val() === <value>) so
// the rule's logic can be checked before the user publishes it in the
// Firebase Console. It is not a substitute for the Console's Rules
// Playground — run that too once published (see the plan's Task 4).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.join(__dirname, '..', 'database.rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

// Fake `users` tree: uid -> { role, status }
const usersTree = {
  'uid-approved-engineer': { role: 'engineer', status: 'approved' },
  'uid-approved-designer': { role: 'designer', status: 'approved' },
  'uid-approved-admin': { role: 'engineer-admin', status: 'approved' },
  'uid-pending-engineer': { role: 'engineer', status: 'pending' },
  'uid-rejected-engineer': { role: 'engineer', status: 'rejected' },
};

// Minimal evaluator for exactly the expression shape this file's rules use:
//   "auth != null && root.child('users').child(auth.uid).child('status').val() === 'approved'"
//   "... && root.child('users').child(auth.uid).child('role').val() !== 'designer'"
function evalRule(expr, authUid) {
  const auth = authUid ? { uid: authUid } : null;
  const root = {
    child(seg1) {
      return {
        child(seg2) {
          return {
            child(field) {
              return {
                val() {
                  if (seg1 !== 'users') throw new Error(`unexpected root.child('${seg1}')`);
                  const user = usersTree[seg2];
                  if (!user) return null;
                  return user[field] ?? null;
                },
              };
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('auth', 'root', `return (${expr});`);
  return fn(auth, root);
}

const cases = [
  // [description, uid|null, expectedRead, expectedWrite]
  ['approved engineer can read+write archive', 'uid-approved-engineer', true, true],
  ['approved designer can read+write archive (no role exclusion)', 'uid-approved-designer', true, true],
  ['approved admin can read+write archive', 'uid-approved-admin', true, true],
  ['pending user cannot read/write archive', 'uid-pending-engineer', false, false],
  ['rejected user cannot read/write archive', 'uid-rejected-engineer', false, false],
  ['unauthenticated (no auth) cannot read/write archive', null, false, false],
  ['unknown uid (not in users tree) cannot read/write archive', 'uid-does-not-exist', false, false],
];

let failed = 0;

for (const node of ['archive', 'archive_lock']) {
  const readExpr = rules.rules[node]['.read'];
  const writeExpr = rules.rules[node]['.write'];
  console.log(`\n=== ${node} ===`);
  for (const [desc, uid, expectRead, expectWrite] of cases) {
    const actualRead = evalRule(readExpr, uid);
    const actualWrite = evalRule(writeExpr, uid);
    const readOk = actualRead === expectRead;
    const writeOk = actualWrite === expectWrite;
    const status = readOk && writeOk ? 'PASS' : 'FAIL';
    if (status === 'FAIL') failed++;
    console.log(
      `  [${status}] ${desc} — read=${actualRead}(expected ${expectRead}) write=${actualWrite}(expected ${expectWrite})`
    );
  }
}

console.log(`\n${failed === 0 ? 'ALL PASS' : `${failed} FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
