const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const sessions = new Map();
let pgPool = null;

const DEFAULT_TOURS = [
 {id:'sajek-2026',title:'সাজেক ভ্যালি + খাগড়াছড়ি',date:'১–৪ অক্টোবর ২০২৬',duration:'৩ রাত ২ দিন',price:4599,image:'hill-group.jpeg',category:'পাহাড়',desc:'মেঘ, পাহাড় ও খাগড়াছড়ির আকর্ষণীয় স্পটসহ গ্রুপ ট্যুর।',details:['নরসিংদী ↔ খাগড়াছড়ি যাওয়া-আসার গাড়ি/বাস','১ দিনের চাঁদের গাড়ি','সাজেকে ১ রাত ভিউ রুম','৫ বেলা খাবার','অভিজ্ঞ গাইড','প্রিমিয়াম প্যাকেজে স্পট এন্ট্রি ফি']},
 {id:'sitakunda-2026',title:'সীতাকুণ্ড',date:'১ অক্টোবর ২০২৬',duration:'২ রাত ১ দিন',price:1499,image:'beach-1.jpeg',category:'প্রকৃতি',desc:'পাহাড়, ঝর্ণা ও সমুদ্রের সৌন্দর্য উপভোগের একদিনের আয়োজন।',details:['যাওয়া-আসার বাস ভাড়া','২ বেলা খাবার','খৈয়াছড়া ঝর্ণার লোকাল ভাড়া','গাইড খরচ']},
 {id:'special',title:'বিশেষ গ্রুপ ট্যুর',date:'তারিখ আলোচনা সাপেক্ষে',duration:'কাস্টম',price:0,image:'karamjal-group.jpeg',category:'গ্রুপ',desc:'আপনার গ্রুপের জন্য কাস্টমাইজড বাংলাদেশ ট্যুর।',details:['রুট পরিকল্পনা','যাতায়াত','থাকা ও খাবার','গাইড ও ব্যবস্থাপনা']}
];

function ensureDb(){fs.mkdirSync(DATA_DIR,{recursive:true});if(!fs.existsSync(DB_FILE))writeDb({tours:DEFAULT_TOURS,bookings:[],visits:[]});}
function readDb(){ensureDb();return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}
function writeDb(db){fs.mkdirSync(DATA_DIR,{recursive:true});const tmp=DB_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,DB_FILE);}
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(body)}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function isAdmin(req){const token=parseCookies(req).ntg_session;const exp=sessions.get(token);if(exp&&exp>Date.now())return true;if(token)sessions.delete(token);return false}
function requireAdmin(req,res){if(!isAdmin(req)){json(res,401,{error:'Unauthorized'});return false}return true}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>2e6)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function validPhone(v){return /^\+?\d[\d\s-]{8,15}$/.test(String(v||''))}
function cleanTour(x){return {id:String(x.id||'tour-'+Date.now()),title:String(x.title||'').trim(),date:String(x.date||'').trim(),duration:String(x.duration||'').trim(),price:Number(x.price)||0,image:String(x.image||'group-1.jpeg').trim(),category:String(x.category||'গ্রুপ').trim(),desc:String(x.desc||'').trim(),details:Array.isArray(x.details)?x.details.map(String):[]}}
function newVisitorId(){return crypto.randomBytes(16).toString('hex')}

async function initPostgres(){
 if(!process.env.DATABASE_URL)return;
 try{
  const {Pool}=require('pg');
  pgPool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
  await pgPool.query(`CREATE TABLE IF NOT EXISTS tours (id TEXT PRIMARY KEY,title TEXT NOT NULL,date TEXT,duration TEXT,price NUMERIC DEFAULT 0,image TEXT,category TEXT,description TEXT,details JSONB DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY,tour_id TEXT,tour TEXT,name TEXT,phone TEXT,date TEXT,travellers INTEGER,message TEXT,status TEXT,created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS visits (id BIGSERIAL PRIMARY KEY,visitor_id TEXT NOT NULL,visited_at TIMESTAMPTZ DEFAULT NOW());`);
  const {rows}=await pgPool.query('SELECT COUNT(*)::int AS n FROM tours');
  if(!rows[0].n){for(const t of DEFAULT_TOURS)await pgPool.query('INSERT INTO tours(id,title,date,duration,price,image,category,description,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[t.id,t.title,t.date,t.duration,t.price,t.image,t.category,t.desc,JSON.stringify(t.details)]);}
  console.log('Persistent PostgreSQL database enabled.');
 }catch(e){console.error('PostgreSQL unavailable; using local JSON database:',e.message);pgPool=null;}
}
async function getTours(){if(!pgPool)return readDb().tours;const {rows}=await pgPool.query('SELECT id,title,date,duration,price,image,category,description AS desc,details FROM tours ORDER BY id');return rows.map(r=>({...r,price:Number(r.price),details:r.details||[]}));}
async function getBookings(){if(!pgPool)return readDb().bookings;const {rows}=await pgPool.query('SELECT id,"tour_id" AS "tourId",tour,name,phone,date,travellers,message,status,"created_at" AS "createdAt" FROM bookings ORDER BY created_at DESC');return rows;}
async function addVisit(visitorId){if(pgPool){await pgPool.query('INSERT INTO visits(visitor_id) VALUES($1)',[visitorId]);return;}const db=readDb();db.visits=db.visits||[];db.visits.push({visitorId,createdAt:new Date().toISOString()});if(db.visits.length>50000)db.visits=db.visits.slice(-50000);writeDb(db);}
async function getStats(){if(pgPool){const [a,b,c,d]=await Promise.all([pgPool.query('SELECT COUNT(*)::int n FROM visits'),pgPool.query('SELECT COUNT(DISTINCT visitor_id)::int n FROM visits'),pgPool.query("SELECT COUNT(*)::int n FROM visits WHERE visited_at >= CURRENT_DATE"),pgPool.query("SELECT COUNT(*)::int n FROM visits WHERE visited_at >= NOW()-INTERVAL '7 days'")]);return {totalVisits:a.rows[0].n,uniqueVisitors:b.rows[0].n,todayVisits:c.rows[0].n,weekVisits:d.rows[0].n};}const v=readDb().visits||[];const today=new Date().toISOString().slice(0,10);const week=Date.now()-7*86400000;return {totalVisits:v.length,uniqueVisitors:new Set(v.map(x=>x.visitorId)).size,todayVisits:v.filter(x=>String(x.createdAt).slice(0,10)===today).length,weekVisits:v.filter(x=>new Date(x.createdAt).getTime()>=week).length};}

async function main(){
 ensureDb(); await initPostgres();
 const server=http.createServer(async(req,res)=>{
  try{
   const u=new URL(req.url,'http://localhost');
   if(req.method==='GET'&&u.pathname==='/api/tours')return json(res,200,{tours:await getTours()});
   if(req.method==='GET'&&u.pathname==='/api/health')return json(res,200,{ok:true,database:pgPool?'postgres':'json'});
   if(req.method==='POST'&&u.pathname==='/api/visit'){
    const cookies=parseCookies(req);const visitorId=cookies.ntg_visitor||newVisitorId();await addVisit(visitorId);res.writeHead(204,{'Set-Cookie':`ntg_visitor=${visitorId}; SameSite=Lax; Path=/; Max-Age=31536000`});return res.end();
   }
   if(req.method==='POST'&&u.pathname==='/api/bookings'){
    const x=await body(req);if(!x.tour||!x.name||!validPhone(x.phone)||!x.date||Number(x.travellers)<1)return json(res,400,{error:'সব প্রয়োজনীয় তথ্য সঠিকভাবে দিন।'});
    const tours=await getTours();const tour=tours.find(t=>t.id===x.tour);if(!tour)return json(res,400,{error:'Tour পাওয়া যায়নি।'});
    const booking={id:'NTG-'+Date.now().toString(36).toUpperCase(),tourId:tour.id,tour:tour.title,name:String(x.name).trim(),phone:String(x.phone).trim(),date:String(x.date),travellers:Number(x.travellers),message:String(x.message||'').trim(),status:'নতুন',createdAt:new Date().toISOString()};
    if(pgPool)await pgPool.query('INSERT INTO bookings(id,tour_id,tour,name,phone,date,travellers,message,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[booking.id,booking.tourId,booking.tour,booking.name,booking.phone,booking.date,booking.travellers,booking.message,booking.status,booking.createdAt]);else{const db=readDb();db.bookings.unshift(booking);writeDb(db);}
    return json(res,201,{ok:true,bookingId:booking.id});
   }
   if(req.method==='POST'&&u.pathname==='/api/admin/login'){
    const x=await body(req);const supplied=Buffer.from(String(x.password||''));const expected=Buffer.from(String(ADMIN_PASSWORD));if(!expected.length||!supplied.length||supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return json(res,401,{error:'পাসওয়ার্ড সঠিক নয়।'});
    const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*60*60*1000);setTimeout(()=>sessions.delete(token),8*60*60*1000);res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`ntg_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV==='production'?'; Secure':''}`});return res.end(JSON.stringify({ok:true}));
   }
   if(req.method==='POST'&&u.pathname==='/api/admin/logout'){const token=parseCookies(req).ntg_session;sessions.delete(token);res.writeHead(200,{'Set-Cookie':`ntg_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`,'Content-Type':'application/json'});return res.end(JSON.stringify({ok:true}));}
   if(u.pathname.startsWith('/api/admin/')){
    if(!requireAdmin(req,res))return;
    if(req.method==='GET'&&u.pathname==='/api/admin/data')return json(res,200,{tours:await getTours(),bookings:await getBookings(),stats:await getStats()});
    if(req.method==='POST'&&u.pathname==='/api/admin/tours'){
     const t=cleanTour(await body(req));if(!t.title)return json(res,400,{error:'Tour name required'});
     if(pgPool)await pgPool.query('INSERT INTO tours(id,title,date,duration,price,image,category,description,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[t.id,t.title,t.date,t.duration,t.price,t.image,t.category,t.desc,JSON.stringify(t.details)]);else{const db=readDb();db.tours.push(t);writeDb(db);}return json(res,201,{tour:t});
    }
    const m=u.pathname.match(/^\/api\/admin\/tours\/([^/]+)$/);if(m){const id=decodeURIComponent(m[1]);if(req.method==='DELETE'){if(pgPool)await pgPool.query('DELETE FROM tours WHERE id=$1',[id]);else{const db=readDb();db.tours=db.tours.filter(t=>t.id!==id);writeDb(db);}return json(res,200,{ok:true});}if(req.method==='PUT'){const tours=await getTours();const old=tours.find(t=>t.id===id);if(!old)return json(res,404,{error:'Not found'});const t=cleanTour({...old,...await body(req),id});if(pgPool)await pgPool.query('UPDATE tours SET title=$2,date=$3,duration=$4,price=$5,image=$6,category=$7,description=$8,details=$9 WHERE id=$1',[id,t.title,t.date,t.duration,t.price,t.image,t.category,t.desc,JSON.stringify(t.details)]);else{const db=readDb();db.tours=db.tours.map(x=>x.id===id?t:x);writeDb(db);}return json(res,200,{tour:t});}}
    const bm=u.pathname.match(/^\/api\/admin\/bookings\/([^/]+)$/);if(bm){const id=decodeURIComponent(bm[1]);if(req.method==='DELETE'){if(pgPool)await pgPool.query('DELETE FROM bookings WHERE id=$1',[id]);else{const db=readDb();db.bookings=db.bookings.filter(b=>b.id!==id);writeDb(db);}return json(res,200,{ok:true});}if(req.method==='PATCH'){const x=await body(req);if(pgPool){const q=await pgPool.query('UPDATE bookings SET status=$2 WHERE id=$1 RETURNING id,"tour_id" AS "tourId",tour,name,phone,date,travellers,message,status,"created_at" AS "createdAt"',[id,String(x.status||'নতুন')]);if(!q.rowCount)return json(res,404,{error:'Not found'});return json(res,200,{booking:q.rows[0]});}const db=readDb();const b=db.bookings.find(x=>x.id===id);if(!b)return json(res,404,{error:'Not found'});b.status=String(x.status||b.status);writeDb(db);return json(res,200,{booking:b});}}
   }
   let filePath=u.pathname==='/'?path.join(ROOT,'index.html'):path.join(ROOT,u.pathname.replace(/^\//,''));if(filePath.startsWith(ROOT)&&fs.existsSync(filePath)&&fs.statSync(filePath).isFile()){const ext=path.extname(filePath);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});return fs.createReadStream(filePath).pipe(res);}res.writeHead(404);res.end('Not found');
  }catch(e){console.error(e);json(res,500,{error:'Server error'})}
 });
 server.listen(PORT,()=>console.log(`NTG Travel running on port ${PORT}`));
}
main();
