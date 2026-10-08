
const express=require("express"),path=require("path"),fs=require("fs"),crypto=require("crypto");
const bcrypt=require("bcryptjs"),jwt=require("jsonwebtoken"),cookieParser=require("cookie-parser"),multer=require("multer");
const app=express(),PORT=process.env.PORT||4000,JWT_SECRET=process.env.JWT_SECRET||"cars-guru-demo-secret-change-me";
const DB=path.join(__dirname,"db.json"),UPLOAD=path.join(__dirname,"uploads");
fs.mkdirSync(UPLOAD,{recursive:true});
app.use(express.json({limit:"4mb"}));app.use(express.urlencoded({extended:true}));app.use(cookieParser());app.use("/uploads",express.static(UPLOAD));app.use(express.static(path.join(__dirname,"..")));
const read=()=>JSON.parse(fs.readFileSync(DB,"utf8")),write=d=>fs.writeFileSync(DB,JSON.stringify(d,null,2));
function auth(req,res,next){try{req.admin=jwt.verify(req.cookies.cg_admin,JWT_SECRET);next()}catch(e){res.status(401).json({error:"Unauthorized"})}}
const storage=multer.diskStorage({destination:(_,__,cb)=>cb(null,UPLOAD),filename:(_,f,cb)=>cb(null,Date.now()+"-"+crypto.randomBytes(5).toString("hex")+path.extname(f.originalname).toLowerCase())});
const upload=multer({storage,limits:{fileSize:8*1024*1024},fileFilter:(_,f,cb)=>/^image\/(jpeg|png|webp|jpg)$/.test(f.mimetype)?cb(null,true):cb(Error("Only JPG, PNG or WEBP images are allowed"))});

app.get("/api/cars",(req,res)=>{let d=read().cars;if(req.query.status)d=d.filter(x=>x.status===req.query.status);if(req.query.body&&req.query.body!=="all")d=d.filter(x=>x.body===req.query.body);if(req.query.fuel&&req.query.fuel!=="all")d=d.filter(x=>x.fuel===req.query.fuel);if(req.query.gear&&req.query.gear!=="all")d=d.filter(x=>x.gear===req.query.gear);if(req.query.yearMin)d=d.filter(x=>Number(x.year)>=Number(req.query.yearMin));if(req.query.q){const q=String(req.query.q).toLowerCase();d=d.filter(x=>`${x.name} ${x.body} ${x.colour} ${x.fuel}`.toLowerCase().includes(q));}if(req.query.featured==="true")d=d.filter(x=>x.featured);res.json(d)});
app.post("/api/analytics/event",(req,res)=>{const allowed=["page_view","car_view","whatsapp_click","compare_add","compare_view"];const type=String(req.body.type||"");if(!allowed.includes(type))return res.status(400).json({error:"Invalid event"});const d=read();d.analytics=d.analytics||[];d.analytics.push({id:crypto.randomBytes(4).toString("hex"),type,carId:req.body.carId||null,carName:req.body.carName||null,createdAt:new Date().toISOString()});if(d.analytics.length>5000)d.analytics=d.analytics.slice(-5000);write(d);res.json({ok:true})});
app.get("/api/admin/dashboard",auth,(req,res)=>{const d=read(),c=d.cars,l=d.enquiries||[];res.json({
 totalCars:c.length,available:c.filter(x=>x.status==="Available").length,sold:c.filter(x=>x.status==="Sold").length,reserved:c.filter(x=>x.status==="Reserved").length,
 featured:c.filter(x=>x.featured).length,newLeads:l.filter(x=>x.status==="New").length,totalLeads:l.length,
 analyticsSummary:{pageViews:(d.analytics||[]).filter(e=>e.type==="page_view").length,carViews:(d.analytics||[]).filter(e=>e.type==="car_view").length,whatsappClicks:(d.analytics||[]).filter(e=>e.type==="whatsapp_click").length,compareAdds:(d.analytics||[]).filter(e=>e.type==="compare_add").length},
 recentLeads:l.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5)
})});
app.get("/api/admin/analytics",auth,(req,res)=>{
 const d=read(),events=d.analytics||[],cars=d.cars||[],now=Date.now(),since=now-30*86400000;
 const recent=events.filter(e=>new Date(e.createdAt).getTime()>=since);
 const count=t=>recent.filter(e=>e.type===t).length;
 const byCar={};recent.filter(e=>e.carId).forEach(e=>{const k=e.carId;byCar[k]=byCar[k]||{id:k,name:e.carName||cars.find(c=>c.id===k)?.name||"Car",views:0,whatsapp:0,compares:0};if(e.type==="car_view")byCar[k].views++;if(e.type==="whatsapp_click")byCar[k].whatsapp++;if(e.type==="compare_add")byCar[k].compares++});
 const topCars=Object.values(byCar).sort((a,b)=>(b.views+b.whatsapp*2)-(a.views+a.whatsapp*2)).slice(0,6);
 const days=[];for(let i=6;i>=0;i--){const dt=new Date(now-i*86400000);const key=dt.toISOString().slice(0,10);days.push({date:key,label:dt.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}),views:recent.filter(e=>e.type==="car_view"&&e.createdAt.slice(0,10)===key).length,whatsapp:recent.filter(e=>e.type==="whatsapp_click"&&e.createdAt.slice(0,10)===key).length});}
 res.json({period:"30 days",pageViews:count("page_view"),carViews:count("car_view"),whatsappClicks:count("whatsapp_click"),compareAdds:count("compare_add"),topCars,days});
});
app.get("/api/admin/enquiries",auth,(req,res)=>res.json(read().enquiries||[]));
app.put("/api/admin/enquiries/:id",auth,(req,res)=>{const d=read(),x=(d.enquiries||[]).find(e=>e.id===req.params.id);if(!x)return res.status(404).json({error:"Lead not found"});x.status=req.body.status||x.status;write(d);res.json(x)});
app.post("/api/admin/login",async(req,res)=>{const d=read();const legacyEnabled=d.admin.legacyDemoPasswordEnabled!==false;const passwordOk=(legacyEnabled&&req.body.password==="CarsGuru@123")||await bcrypt.compare(req.body.password,d.admin.passwordHash).catch(()=>false);if(req.body.email!==d.admin.email||!passwordOk)return res.status(401).json({error:"Invalid email or password"});res.cookie("cg_admin",jwt.sign({email:req.body.email,role:"admin"},JWT_SECRET,{expiresIn:"8h"}),{httpOnly:true,sameSite:"lax",secure:false,maxAge:28800000});res.json({ok:true})});
app.post("/api/admin/change-password",async(req,res)=>{const d=read(),email=String(req.body.email||"").trim().toLowerCase(),current=String(req.body.currentPassword||""),next=String(req.body.newPassword||""),confirm=String(req.body.confirmPassword||"");if(email!==String(d.admin.email||"").toLowerCase())return res.status(401).json({error:"Invalid email or current password"});if(next.length<8)return res.status(400).json({error:"New password must be at least 8 characters"});if(next!==confirm)return res.status(400).json({error:"New passwords do not match"});const legacyEnabled=d.admin.legacyDemoPasswordEnabled!==false;const currentOk=(legacyEnabled&&current==="CarsGuru@123")||await bcrypt.compare(current,d.admin.passwordHash).catch(()=>false);if(!currentOk)return res.status(401).json({error:"Invalid email or current password"});d.admin.passwordHash=await bcrypt.hash(next,10);d.admin.legacyDemoPasswordEnabled=false;write(d);res.clearCookie("cg_admin");res.json({ok:true,message:"Password changed successfully. Please sign in with your new password."})});
app.post("/api/admin/logout",(req,res)=>{res.clearCookie("cg_admin");res.json({ok:true})});app.get("/api/admin/me",auth,(req,res)=>res.json({ok:true,email:req.admin.email}));

function fields(b,old={}){return {
 name:b.name?.trim()??old.name,year:Number(b.year??old.year),km:Number(b.km ?? old.km ?? 0),fuel:b.fuel??old.fuel,gear:b.gear??old.gear,body:b.body??old.body,
 price:b.price?.trim()??old.price,colour:b.colour?.trim()??old.colour,owners:Number(b.owners ?? old.owners ?? 1),engine:b.engine?.trim()??old.engine,
 location:(b.location?.trim() ?? old.location ?? "Pune"),description:(b.description?.trim() ?? old.description ?? ""),tag:(b.tag?.trim() ?? old.tag ?? "NEW STOCK"),
 status:(b.status ?? old.status ?? "Available"),featured:String(b.featured??old.featured) === "true",discount:(b.discount?.trim() ?? old.discount ?? "")
}}
function saveUploads(files){return (files||[]).map(f=>"/uploads/"+f.filename)}
app.post("/api/admin/cars",auth,upload.array("images",8),(req,res)=>{const d=read(),b=req.body,imgs=saveUploads(req.files);const car={id:"cg-"+crypto.randomBytes(4).toString("hex"),...fields(b),images:imgs,image:imgs[0]||b.image||""};if(!car.name||!car.year||!car.price||!car.image)return res.status(400).json({error:"Name, year, price and at least one image are required"});d.cars.unshift(car);write(d);res.status(201).json(car)});
app.put("/api/admin/cars/:id",auth,upload.array("images",8),(req,res)=>{const d=read(),i=d.cars.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:"Car not found"});const old=d.cars[i],imgs=saveUploads(req.files);d.cars[i]={...old,...fields(req.body,old),images:imgs.length?imgs:(old.images||[old.image]),image:imgs[0]||(old.images||[old.image])[0]};write(d);res.json(d.cars[i])});
app.patch("/api/admin/cars/:id/status",auth,(req,res)=>{const d=read(),x=d.cars.find(c=>c.id===req.params.id);if(!x)return res.status(404).json({error:"Car not found"});x.status=req.body.status;x.featured=!!req.body.featured;write(d);res.json(x)});
app.delete("/api/admin/cars/:id",auth,(req,res)=>{const d=read(),x=d.cars.find(c=>c.id===req.params.id);if(!x)return res.status(404).json({error:"Car not found"});d.cars=d.cars.filter(c=>c.id!==req.params.id);write(d);res.json({ok:true})});
app.post("/api/enquiries",(req,res)=>{const d=read();const e={id:"lead-"+crypto.randomBytes(4).toString("hex"),name:req.body.name,phone:req.body.phone,car:req.body.car||"General enquiry",message:req.body.message||"",status:"New",createdAt:new Date().toISOString()};d.enquiries=d.enquiries||[];d.enquiries.unshift(e);write(d);res.status(201).json({ok:true})});
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"..","admin.html")));
app.listen(PORT,()=>console.log("Cars Guru V4 running on http://localhost:"+PORT));
