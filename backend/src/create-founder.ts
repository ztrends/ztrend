import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { query, pool } from './db.js';
import { hashPassword } from './auth.js';
const args=process.argv.slice(2);
function arg(name:string){const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
const name=arg('--name')||'Founder';
const email=arg('--email');
if(!email){console.error('Usage: npm run founder:create --workspace backend -- --name "Name" --email "founder@example.com"');process.exit(1);}
const existing=await query("SELECT id FROM users WHERE identity_type='FOUNDER' LIMIT 1");
if(existing.rowCount){console.error('A Founder account already exists; refusing to create another through this setup command.');await pool.end();process.exit(1);}
const rl=readline.createInterface({input,output});
const password=await rl.question('Choose a strong Founder password (10+ characters): ');
rl.close();
if(password.length<10){console.error('Password must be at least 10 characters.');await pool.end();process.exit(1);}
try{await query("INSERT INTO users(name,email,password_hash,identity_type) VALUES($1,lower($2),$3,'FOUNDER')",[name,email,await hashPassword(password)]);console.log('Founder account created. Store credentials securely.');}
catch(e){console.error('Could not create Founder:',e);process.exitCode=1;}
finally{await pool.end();}
