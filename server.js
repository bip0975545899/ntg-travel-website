const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || ADMIN_PASSWORD || 'ntg-fallback-secret').trim();
const SESSION_TTL = 8 * 60 * 60 * 1000;

const DEFAULT_TOURS = [
 {id:'sajek-2026',title:'সাজেক ভ্যালি + খাগড়াছড়ি',date:'১–৪ অক্টোবর ২০২৬',duration:'৩ রাত ২ দিন',price:4599,image:'assets/hill-group.jpeg',category:'পাহাড়',desc:'মেঘ, পাহাড় ও খাগড়াছড়ির আকর্ষণীয় স্পটসহ গ্রুপ ট্যুর।',details:['নরসিংদী ↔ খাগড়াছড়ি যাওয়া-আসার গাড়ি/বাস','১ দিনের চাঁদের গাড়ি','সাজেকে ১ রাত ভিউ রুম','৫ বেলা খাবার','অভিজ্ঞ গাইড','প্রিমিয়াম প্যাকেজে স্পট এন্ট্রি ফি']},
 {id:'sitakunda-2026',title:'সীতাকুণ্ড',date:'১ অক্টোবর ২০২৬',duration:'২ রাত ১ দিন',price:1499,image:'assets/beach-1.jpeg',category:'প্রকৃতি',desc:'পাহাড়, ঝর্ণা ও সমুদ্রের সৌন্দর্য উপভোগের একদিনের আয়োজন।',details:['যাওয়া-আসার বাস ভাড়া','২ বেলা খাবার','খৈয়াছড়া ঝর্ণার লোকাল ভাড়া','গাইড খরচ']},
 {id:'special',title:'বিশেষ গ্রুপ ট্যুর',date:'তারিখ আলোচনা সাপেক্ষে',duration:'কাস্টম',price:0,image:'assets/karamjal-group.jpeg',category:'গ্রুপ',desc:'আপনার গ্রুপের জন্য কাস্টমাইজড বাংলাদেশ ট্যুর।',details:['রুট পরিকল্পনা','যাতায়াত','থাকা ও খাবার','গাইড ও ব্যবস্থাপনা']}
];

function ensureDb(){
 fs.mkdirSync(DATA_DIR,{recursive:true});
 if(!fs.existsSync(DB_FILE)) writeDb({tours:DEFAULT_TOURS, bookings:[]});
}
function readDb(){ensureDb(); return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}
function writeDb(db){
 fs.mkdirSync(DATA_DIR,{recursive:true});
 const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(db,null,2)); fs.renameSync(tmp,DB_FILE);
}
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(body)}
function parseCookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]}))}
function makeSession(){
 const exp=Date.now()+SESSION_TTL;
 const nonce=crypto.randomBytes(24).toString('hex');
 const payload=`${exp}.${nonce}`;
 const sig=crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('hex');
 return `${payload}.${sig}`;
}
function isAdmin(req){
 try{
  const token=parseCookies(req).ntg_session;
  if(!token)return false;
  const parts=token.split('.');
  if(parts.length!==3)return false;
  const [exp,nonce,sig]=parts;
  if(!/^\d+$/.test(exp) || Number(exp)<Date.now() || !/^[a-f0-9]{48}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(sig))return false;
  const expected=crypto.createHmac('sha256',SESSION_SECRET).update(`${exp}.${nonce}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));
 }catch{return false}
}
function requireAdmin(req,res){if(!isAdmin(req)){json(res,401,{error:'Unauthorized'});return false}return true}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}});req.on('error',reject)})}
function validPhone(v){return /^\+?\d[\d\s-]{8,15}$/.test(String(v||''))}
function cleanTour(x){return {id:String(x.id||'tour-'+Date.now()),title:String(x.title||'').trim(),date:String(x.date||'').trim(),duration:String(x.duration||'').trim(),price:Number(x.price)||0,image:String(x.image||'assets/group-1.jpeg'),category:String(x.category||'গ্রুপ'),desc:String(x.desc||''),details:Array.isArray(x.details)?x.details.map(String):[]}}

ensureDb();
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET' && u.pathname==='/api/tours') return json(res,200,{tours:readDb().tours});
  if(req.method==='GET' && u.pathname==='/api/health') return json(res,200,{ok:true});
  if(req.method==='POST' && u.pathname==='/api/bookings'){
   const x=await body(req);
   if(!x.tour || !x.name || !validPhone(x.phone) || !x.date || Number(x.travellers)<1) return json(res,400,{error:'সব প্রয়োজনীয় তথ্য সঠিকভাবে দিন।'});
   const db=readDb(); const tour=db.tours.find(t=>t.id===x.tour); if(!tour)return json(res,400,{error:'Tour পাওয়া যায়নি।'});
   const booking={id:'NTG-'+Date.now().toString(36).toUpperCase(),tourId:tour.id,tour:tour.title,name:String(x.name).trim(),phone:String(x.phone).trim(),date:String(x.date),travellers:Number(x.travellers),message:String(x.message||'').trim(),status:'নতুন',createdAt:new Date().toISOString()};
   db.bookings.unshift(booking);writeDb(db);return json(res,201,{ok:true,bookingId:booking.id});
  }
  if(req.method==='GET' && u.pathname==='/api/admin/status') return json(res,200,{configured:Boolean(ADMIN_PASSWORD),authenticated:isAdmin(req)});
  if(req.method==='POST' && u.pathname==='/api/admin/login'){
   const x=await body(req);
   if(!ADMIN_PASSWORD) return json(res,503,{error:'Admin password is not configured on the server.'});
   const supplied=String(x.password??'').trim();
   if(!supplied) return json(res,400,{error:'Password দিন।'});
   const a=Buffer.from(supplied), b=Buffer.from(ADMIN_PASSWORD);
   if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return json(res,401,{error:'পাসওয়ার্ড সঠিক নয়।'});
   const token=makeSession();
   const cookie=`ntg_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL/1000}${process.env.NODE_ENV==='production'?'; Secure':''}`;
   res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Set-Cookie':cookie});
   return res.end(JSON.stringify({ok:true}));
  }
  if(req.method==='POST' && u.pathname==='/api/admin/logout'){res.writeHead(200,{'Set-Cookie':`ntg_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify({ok:true}))}
  if(u.pathname.startsWith('/api/admin/')){
   if(!requireAdmin(req,res))return;
   const db=readDb();
   if(req.method==='GET' && u.pathname==='/api/admin/data') return json(res,200,{tours:db.tours,bookings:db.bookings});
   if(req.method==='POST' && u.pathname==='/api/admin/tours'){const t=cleanTour(await body(req));if(!t.title)return json(res,400,{error:'Tour name required'});db.tours.push(t);writeDb(db);return json(res,201,{tour:t})}
   const m=u.pathname.match(/^\/api\/admin\/tours\/([^/]+)$/);if(m){const id=decodeURIComponent(m[1]);if(req.method==='DELETE'){db.tours=db.tours.filter(t=>t.id!==id);writeDb(db);return json(res,200,{ok:true})}if(req.method==='PUT'){const old=db.tours.find(t=>t.id===id);if(!old)return json(res,404,{error:'Not found'});const t=cleanTour({...old,...await body(req),id});db.tours=db.tours.map(x=>x.id===id?t:x);writeDb(db);return json(res,200,{tour:t})}}
   const bm=u.pathname.match(/^\/api\/admin\/bookings\/([^/]+)$/);if(bm){const id=decodeURIComponent(bm[1]);if(req.method==='DELETE'){db.bookings=db.bookings.filter(b=>b.id!==id);writeDb(db);return json(res,200,{ok:true})}if(req.method==='PATCH'){const b=db.bookings.find(x=>x.id===id);if(!b)return json(res,404,{error:'Not found'});const x=await body(req);b.status=String(x.status||b.status);writeDb(db);return json(res,200,{booking:b})}}
  }
  let filePath=u.pathname==='/'?path.join(ROOT,'index.html'):path.join(ROOT,u.pathname.replace(/^\//,''));
  if(filePath.startsWith(ROOT) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()){const ext=path.extname(filePath);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});return fs.createReadStream(filePath).pipe(res)}
  res.writeHead(404);res.end('Not found');
 }catch(e){console.error(e);json(res,500,{error:'Server error'})}
});
server.listen(PORT,()=>console.log(`NTG Travel running on port ${PORT}`));
