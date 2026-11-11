const router=require('express').Router();
const {query}=require('../../db/connection');
const wa=require('../../services/whatsapp');
const {callbackUrl}=require('../../services/whatsappConnection');
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.get('/',async(req,res)=>{const c=await wa.config();res.json({enabled:c.enabled,sid:c.sid,from:c.from,tokenConfigured:!!c.token,templates:c.templates,callbackUrl:callbackUrl(c),webhookConfigured:!!c.webhook_configured_at});});
router.put('/',async(req,res)=>{if(req.user.role!=='platform_owner')return res.status(403).json({error:'Only the platform owner can change Twilio credentials.'});try{await wa.saveConfig(req.body,{configure:true});res.json({saved:true});}catch(e){res.status(400).json({error:e.message});}});
router.post('/test',async(req,res)=>{try{res.json(await wa.checkConnection());}catch(e){res.status(400).json({error:'Twilio connection failed. Check the saved Account SID and Auth Token.'});}});
router.post('/test-message',async(req,res)=>{
 const phone=wa.normalizeWhatsappNumber(req.body.phone);
 if(!phone||req.body.consent!==true)return res.status(400).json({error:'Enter your test number and confirm permission to message it.'});
 const c=await wa.config();
 if(!c.sid||!c.token)return res.status(400).json({error:'Save your Twilio Account SID and Auth Token first.'});
 const blocked=await query('SELECT phone FROM whatsapp_optouts WHERE phone=$1',[phone]);if(blocked.rows.length)return res.status(400).json({error:'This number opted out. Use a different consenting test number.'});
 const vars=wa.variables('confirmation',{id:'TEST-ONLY',name:'Test customer',service_name:'Integration test — no appointment created',booking_date:'2030-01-01',booking_time:'10:00'},{name:'ICSS Bookings test'});
 const log=await query(`INSERT INTO whatsapp_deliveries(recipient,template,variables,status,attempts) VALUES($1,'confirmation',$2,'sending',1) RETURNING id`,[phone,JSON.stringify(vars)]);
 try{const axios=require('axios');const body=new URLSearchParams({To:'whatsapp:'+phone,From:'whatsapp:'+c.from,ContentSid:c.templates.confirmation,ContentVariables:JSON.stringify(vars),StatusCallback:callbackUrl(c)});
 const response=await axios.post('https://api.twilio.com/2010-04-01/Accounts/'+c.sid+'/Messages.json',body.toString(),{auth:{username:c.sid,password:c.token},headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:15000});
 await query('UPDATE whatsapp_deliveries SET status=$2,message_sid=$3,updated_at=NOW() WHERE id=$1',[log.rows[0].id,response.data.status,response.data.sid]);res.json({status:response.data.status});
 }catch(e){await query("UPDATE whatsapp_deliveries SET status='unknown',error='Test request failed; check Twilio logs before retrying.' WHERE id=$1",[log.rows[0].id]);res.status(400).json({error:'Test message could not be confirmed. Check Twilio logs before retrying.'});}
});
router.get('/history',async(req,res)=>{const r=await query(`SELECT id,tenant_id,booking_id,recipient,template,status,message_sid,error,created_at FROM whatsapp_deliveries ORDER BY id DESC LIMIT 100`);res.json({deliveries:r.rows});});
router.get('/businesses',async(req,res)=>{const r=await query(`SELECT t.id,t.name,COALESCE(p.enabled,true) AS enabled,COALESCE(p.providers,'[]') AS providers,COALESCE(p.reminders,'[24,2]') AS reminders,COALESCE(p.daily_limit,100) AS daily_limit FROM tenants t LEFT JOIN whatsapp_preferences p ON p.tenant_id=t.id ORDER BY t.name`);res.json({businesses:r.rows});});
router.put('/businesses/:id',async(req,res)=>{
 const providers=req.body.providers,reminders=req.body.reminders;
 if(!Array.isArray(providers)||providers.length>20||!Array.isArray(reminders)||reminders.length>4||reminders.some(h=>!Number.isInteger(h)||h<1||h>168))return res.status(400).json({error:'Use up to 20 recipients and 4 reminder times from 1 to 168 hours.'});
 if(!Number.isInteger(req.body.daily_limit)||req.body.daily_limit<1||req.body.daily_limit>10000)return res.status(400).json({error:'Daily message limit must be between 1 and 10,000.'});
 const clean=providers.map(p=>({name:String(p.name||'').trim().slice(0,100),phone:wa.normalizeWhatsappNumber(p.phone),opt_in:p.opt_in===true,consent_recorded_at:new Date().toISOString()}));
 if(clean.some(p=>!p.name||!p.phone))return res.status(400).json({error:'Each provider needs a name and valid phone number.'});
 if(!/^[a-f0-9-]{36}$/i.test(req.params.id))return res.status(400).json({error:'Invalid business ID.'});
 const r=await query('SELECT id FROM tenants WHERE id=$1',[req.params.id]);if(!r.rows.length)return res.sendStatus(404);
 await query(`INSERT INTO whatsapp_preferences(tenant_id,enabled,providers,reminders,daily_limit) VALUES($1,$2,$3,$4,$5) ON CONFLICT(tenant_id) DO UPDATE SET enabled=$2,providers=$3,reminders=$4,daily_limit=$5,enabled_at=CASE WHEN $2 AND NOT whatsapp_preferences.enabled THEN NOW() ELSE whatsapp_preferences.enabled_at END,updated_at=NOW()`,[req.params.id,req.body.enabled===true,JSON.stringify(clean),JSON.stringify([...new Set(reminders)]),req.body.daily_limit]);res.json({saved:true});
});
module.exports=router;
