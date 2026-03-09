const express = require("express")
const cors = require("cors")
const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const multer = require("multer")
const sqlite3 = require("sqlite3").verbose()

const app = express()
const PORT = 3000

const ROOT = __dirname
const PUBLIC_DIR = path.join(ROOT,"public")
const UPLOAD_DIR = path.join(ROOT,"uploads")
const DB_PATH = path.join(ROOT,"mega-signage.db")

// estado global de sincronización
let syncState = {
 startAt:0,
 seq:0,
 scope:"ALL"
}

app.use(cors())
app.use(express.json({limit:"100mb"}))
app.use(express.urlencoded({extended:true}))

app.use((req,res,next)=>{
 const ts=new Date().toISOString()
 console.log([${ts}] ${req.method} ${req.url})
 next()
})

if(!fs.existsSync(UPLOAD_DIR)){
 fs.mkdirSync(UPLOAD_DIR,{recursive:true})
}

app.use("/public",express.static(PUBLIC_DIR))
app.use("/uploads",express.static(UPLOAD_DIR))

app.get("/",(req,res)=>{
 res.redirect("/public/admin.html")
})

const db=new sqlite3.Database(DB_PATH)

function run(sql,params=[]){
 return new Promise((resolve,reject)=>{
  db.run(sql,params,function(err){
   if(err) reject(err)
   else resolve(this)
  })
 })
}

function get(sql,params=[]){
 return new Promise((resolve,reject)=>{
  db.get(sql,params,function(err,row){
   if(err) reject(err)
   else resolve(row)
  })
 })
}

function all(sql,params=[]){
 return new Promise((resolve,reject)=>{
  db.all(sql,params,function(err,rows){
   if(err) reject(err)
   else resolve(rows)
  })
 })
}

function nowMs(){
 return Date.now()
}

function makeToken(){
 return "t_"+crypto.randomBytes(16).toString("hex")
}

function makePairCode(){
 return String(Math.floor(100000+Math.random()*900000))
}

function isOnline(lastSeen){
 if(!lastSeen) return false
 return nowMs()-lastSeen<=15000
}

// ==========================
// INIT DB
// ==========================

async function initDb(){

 await run(`
 CREATE TABLE IF NOT EXISTS players(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 token TEXT NOT NULL UNIQUE,
 pairing_code TEXT NOT NULL UNIQUE,
 screen_id INTEGER,
 paired_at INTEGER,
 last_seen INTEGER DEFAULT 0
 )`)

 await run(`
 CREATE TABLE IF NOT EXISTS screens(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 floor TEXT DEFAULT '',
 width_px INTEGER DEFAULT 0,
 height_px INTEGER DEFAULT 0
 )`)

 await run(`
 CREATE TABLE IF NOT EXISTS media(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 filename TEXT NOT NULL,
 original_name TEXT NOT NULL,
 mime TEXT NOT NULL,
 size INTEGER DEFAULT 0,
 created_at INTEGER NOT NULL
 )`)

 await run(`
 CREATE TABLE IF NOT EXISTS playlists(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 screen_name TEXT NOT NULL,
 name TEXT NOT NULL,
 media_ids TEXT NOT NULL,
 active INTEGER DEFAULT 0,
 created_at INTEGER NOT NULL
 )`)

 console.log("DB OK")
}

initDb()

// ==========================
// MEDIA
// ==========================

const storage=multer.diskStorage({
 destination:function(req,file,cb){
  cb(null,UPLOAD_DIR)
 },
 filename:function(req,file,cb){
  const ext=path.extname(file.originalname||"")
  const fname=${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}
  cb(null,fname)
 }
})

const upload=multer({storage})

app.post("/api/media/upload",upload.single("file"),async(req,res)=>{
 try{

 if(!req.file){
  return res.status(400).json({ok:false})
 }

 await run(`
 INSERT INTO media(filename,original_name,mime,size,created_at)
 VALUES(?,?,?,?,?)
 `,[
  req.file.filename,
  req.file.originalname,
  req.file.mimetype,
  req.file.size,
  nowMs()
 ])

 return res.json({ok:true})

 }catch(e){
  console.error(e)
  res.status(500).json({ok:false})
 }
})

app.get("/api/media",async(req,res)=>{

 const rows=await all(SELECT * FROM media ORDER BY id DESC)

 const list=rows.map(m=>({
  id:m.id,
  filename:m.filename,
  original_name:m.original_name,
  url:/uploads/${m.filename}
 }))

 res.json(list)
})

// ==========================
// PLAYER REGISTER
// ==========================

app.post("/api/player/register",async(req,res)=>{

 const token=makeToken()
 const pairing_code=makePairCode()

 await run(`
 INSERT INTO players(name,token,pairing_code,last_seen)
 VALUES(?,?,?,?)
 `,[
  "ANDROID-BOX",
  token,
  pairing_code,
  nowMs()
 ])

 res.json({
  ok:true,
  token,
  pairing_code
 })

})

// ==========================
// HEARTBEAT
// ==========================

app.post("/api/player/heartbeat",async(req,res)=>{

 const token=req.body.token

 if(!token){
  return res.status(400).json({ok:false})
 }

 await run(`
 UPDATE players SET last_seen=?
 WHERE token=?
 `,[nowMs(),token])

 res.json({ok:true})

})

// ==========================
// CONFIG
// ==========================

app.get("/api/player/config",async(req,res)=>{

 const token=req.query.token

 const p=await get(`
 SELECT * FROM players WHERE token=?
 `,[token])

 if(!p){
  return res.json({ok:false})
 }

 await run(`
 UPDATE players SET last_seen=?
 WHERE token=?
 `,[nowMs(),token])

 if(!p.screen_id){

  return res.json({
   ok:true,
   paired:false,
   pairing_code:p.pairing_code,
   sync:syncState
  })

 }

 const screen=await get(`
 SELECT * FROM screens WHERE id=?
 `,[p.screen_id])

 const playlist=await get(`
 SELECT * FROM playlists
 WHERE screen_name=? AND active=1
 `,[screen.name])

 let items=[]

 if(playlist){

  const mediaIds=JSON.parse(playlist.media_ids||"[]")

  if(mediaIds.length>0){

   const placeholders=mediaIds.map(()=>"?").join(",")

   const rows=await all(`
   SELECT * FROM media WHERE id IN(${placeholders})
   `,mediaIds)

   const map={}

   rows.forEach(m=>map[m.id]=m)

   items=mediaIds.map(id=>{
    const m=map[id]
    return{
     id:m.id,
     name:m.original_name,
     url:/uploads/${m.filename}
    }
   })

  }

 }

 res.json({
  ok:true,
  paired:true,
  screen:screen.name,
  screen_cfg:{
   width_px:screen.width_px,
   height_px:screen.height_px
  },
  items,
  sync:syncState
 })

})

// ==========================
// SYNC PLAY
// ==========================

app.post("/api/sync/play",async(req,res)=>{

 const scope=req.body.scope||"ALL"

 const startDelay=6000

 syncState={
  startAt:nowMs()+startDelay,
  seq:syncState.seq+1,
  scope
 }

 console.log("SYNC START",syncState)

 res.json({
  ok:true,
  startAt:syncState.startAt,
  seq:syncState.seq
 })

})

// ==========================
// PLAYERS
// ==========================

app.get("/api/players",async(req,res)=>{

 const rows=await all(`
 SELECT p.*,s.name as screen_name
 FROM players p
 LEFT JOIN screens s ON s.id=p.screen_id
 `)

 const list=rows.map(p=>({
  id:p.id,
  code:p.pairing_code,
  screen:p.screen_name||"-",
  online:isOnline(p.last_seen)
 }))

 res.json(list)

})

// ==========================

app.listen(PORT,"0.0.0.0",()=>{
 console.log("Mega Signage Server")
 console.log(http://0.0.0.0:${PORT}/public/admin.html)
})