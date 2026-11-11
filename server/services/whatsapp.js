const axios = require('axios');
const { query, transaction } = require('../db/connection');
const { encrypt, decrypt } = require('./encryption');
const crypto = require('crypto');
const TEMPLATES = {
 confirmation:'HXcdfce55e0a94b839b263ae3dfeac5c36', client_reminder:'HXfe8bf80c890570aafde1947d800aeade', provider_reminder:'HXc4f072938b0dc6f2aeb8991c18203959', provider_new:'HX25fe5c6633d8b610109f9ed704499fd8', request:'HX770edfc0063f1fe355726d335de6bae3', client_rescheduled:'HX5b8b3313bd2a90c15ace53d3f663490c', provider_rescheduled:'HX62e95b086a56e4a6b2284be45c081bc6', client_cancelled:'HX1e132f7e824cc3c71c75c4db87543f0b', provider_cancelled:'HXfd8946274c7fa800a74ea48b531e4231'
};
function normalizeWhatsappNumber(value) {
 const raw=String(value||'').replace(/^whatsapp:/,'').trim(), digits=raw.replace(/\D/g,'');
 if(raw.startsWith('+') && digits.length>=8 && digits.length<=15)return '+'+digits;
 if(digits.length===10)return '+1'+digits;
 if(digits.length===11 && digits.startsWith('1'))return '+'+digits;
 return null;
}
async function config() {
 const {rows}=await query('SELECT config FROM whatsapp_settings WHERE id=1');
 const c=rows[0]?.config;
 return c ? {...c, token:decrypt(c.token),templates:{...TEMPLATES,...c.templates}} : {enabled:false,sid:process.env.TWILIO_ACCOUNT_SID||'',token:process.env.TWILIO_AUTH_TOKEN||'',from:process.env.TWILIO_WHATSAPP_FROM||'+16676604341',templates:TEMPLATES};
}
async function saveConfig(input) {
 const c=await config();
 const next={enabled:input.enabled===true,sid:String(input.sid||'').trim(),from:normalizeWhatsappNumber(input.from),token:input.token||c.token,templates:{...TEMPLATES,...input.templates}};
 if(!/^AC[a-f0-9]{32}$/i.test(next.sid)||!next.from||!next.token||next.token.length>256)throw new Error('Valid Account SID, sender number and Auth Token are required.');
 if(Object.values(next.templates).some(x=>!/^HX[a-f0-9]{32}$/i.test(x)))throw new Error('Every template must have a valid HX SID.');
 if(next.enabled&&!/^https:\/\//.test(process.env.BASE_URL||''))throw new Error('Set the server BASE_URL to its public HTTPS URL before enabling WhatsApp.');
 next.enabled_at=next.enabled && !c.enabled ? new Date().toISOString() : c.enabled_at;
 next.token=encrypt(next.token);
 await query(`INSERT INTO whatsapp_settings(id,config) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET config=$1,updated_at=NOW()`,[JSON.stringify(next)]);
}
function day(v){return v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10);}
function when(b){return `${day(b.booking_date)} at ${String(b.booking_time||'').slice(0,5)} (Jamaica time)`;}
function variables(type,b,t,provider,old) {
 const ref=String(b.id), client=b.name||'Client', business=t.name, service=b.service_name||'Appointment';
 let a;
 if(type==='client_cancelled')a=[client,business,service,when(b),ref];
 else if(type==='client_rescheduled')a=[client,business,service,when(old),when(b),ref];
 else if(type==='provider_rescheduled')a=[provider.name,business,client,service,when(old),when(b),ref];
 else if(type==='provider_cancelled')a=[provider.name,business,client,service,when(b),ref];
 else if(type.startsWith('provider'))a=[provider.name,business,client,service,day(b.booking_date),String(b.booking_time).slice(0,5)+' (Jamaica time)',ref];
 else a=[client,business,service,day(b.booking_date),String(b.booking_time).slice(0,5)+' (Jamaica time)',ref];
 return Object.fromEntries(a.map((v,i)=>[String(i+1),String(v)]));
}
async function api(c,path,method='get',body) {
 return axios({url:`https://api.twilio.com/2010-04-01/Accounts/${c.sid}${path}`,method,data:body,auth:{username:c.sid,password:c.token},timeout:15000,headers:body?{'Content-Type':'application/x-www-form-urlencoded'}:undefined});
}
async function checkConnection(){const c=await config();const r=await api(c,'.json');return {accountStatus:r.data.status};}
async function plan(e) {
 await transaction(async db=>{
 const lock=await db.query('SELECT * FROM whatsapp_events WHERE id=$1 AND processed_at IS NULL FOR UPDATE',[e.id]);if(!lock.rows.length)return;
 const {rows}=await db.query(`SELECT b.*,s.name AS service_name,t.name AS business_name,p.enabled AS wa_enabled,p.providers,p.reminders,p.enabled_at,(SELECT created_at>=p.enabled_at FROM whatsapp_events WHERE id=$2) AS activation_eligible FROM bookings b JOIN tenants t ON t.id=b.tenant_id LEFT JOIN services s ON s.id=b.service_id LEFT JOIN whatsapp_preferences p ON p.tenant_id=b.tenant_id WHERE b.id=$1`,[e.booking_id,e.id]);
 const b=rows[0];
 const settings=await config();
 if(b?.wa_enabled && b.activation_eligible && new Date(e.created_at)>=new Date(settings.enabled_at||Date.now())){
 const reminder=e.kind.startsWith('reminder_');
 // Recheck current status and schedule before planning an older event.
 const live=!['cancelled','rejected','expired','completed','no_show'].includes(b.status);
 const valid= e.kind==='cancelled' ? ['cancelled','rejected'].includes(b.status) : live;
 if(valid && (!reminder||b.status==='confirmed')){
 const eventBooking={...b,...(e.snapshot||{}),service_name:b.service_name};
 const customerType=reminder?'client_reminder':e.kind==='cancelled'?'client_cancelled':e.kind==='rescheduled'?'client_rescheduled':eventBooking.status==='confirmed'?'confirmation':'request';
 const providerType=reminder?'provider_reminder':e.kind==='cancelled'?'provider_cancelled':e.kind==='rescheduled'?'provider_rescheduled':'provider_new';
 const recipients=[];
 if(b.whatsapp_opt_in && !(e.kind==='new' && eventBooking.status!=='confirmed' && b.status==='confirmed') && !(e.kind==='confirmed'&&b.status!=='confirmed'))recipients.push({phone:b.phone,type:customerType});
 if(e.kind!=='confirmed')for(const p of b.providers||[])if(p.opt_in)recipients.push({...p,type:providerType});
 for(const p of recipients){const phone=normalizeWhatsappNumber(p.phone);if(!phone)continue;
 await db.query(`INSERT INTO whatsapp_deliveries(event_id,tenant_id,booking_id,recipient,template,variables) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,[e.id,b.tenant_id,b.id,phone,p.type,JSON.stringify(variables(p.type,eventBooking,{name:b.business_name},p,e.previous))]);}
 }}
 await db.query('UPDATE whatsapp_events SET processed_at=NOW() WHERE id=$1',[e.id]);
 });
}
async function tick(){
 const c=await config();if(!c.enabled)return;
 // A request left in-flight across a crash cannot safely be replayed: reconcile it with Twilio logs.
 await query(`UPDATE whatsapp_deliveries SET status='unknown',error='Request interrupted; reconcile with Twilio logs before retrying.',updated_at=NOW() WHERE status='sending' AND updated_at<NOW()-INTERVAL '5 minutes'`);
 await query(`INSERT INTO whatsapp_events(booking_id,kind,version,snapshot) SELECT b.id,'reminder_'||h.hours,b.start_time::text,to_jsonb(b) FROM bookings b JOIN whatsapp_preferences p ON p.tenant_id=b.tenant_id CROSS JOIN LATERAL jsonb_array_elements_text(p.reminders) h(hours) WHERE p.enabled AND b.status='confirmed' AND b.start_time>NOW() AND b.start_time-NOW() BETWEEN (h.hours::int*INTERVAL '1 hour')-INTERVAL '2 minutes' AND h.hours::int*INTERVAL '1 hour' ON CONFLICT DO NOTHING`);
 const events=await query('SELECT * FROM whatsapp_events WHERE processed_at IS NULL ORDER BY id LIMIT 100');for(const e of events.rows)await plan(e);
 for(let i=0;i<50;i++){
 const claimed=await transaction(async db=>{await db.query('SELECT pg_advisory_xact_lock(834991)');return db.query(`UPDATE whatsapp_deliveries d SET status='sending',attempts=attempts+1,updated_at=NOW() WHERE id=(SELECT w.id FROM whatsapp_deliveries w JOIN whatsapp_preferences p ON p.tenant_id=w.tenant_id WHERE w.status='pending' AND w.next_attempt_at<=NOW() AND (SELECT COUNT(*) FROM whatsapp_deliveries x WHERE x.tenant_id=w.tenant_id AND x.status NOT IN ('pending','skipped') AND x.created_at>=date_trunc('day',NOW() AT TIME ZONE 'America/Jamaica') AT TIME ZONE 'America/Jamaica')<p.daily_limit ORDER BY w.id FOR UPDATE OF w SKIP LOCKED LIMIT 1) RETURNING d.*`);});const d=claimed.rows[0];if(!d)break;
 const live=await query(`SELECT b.*,p.enabled AS wa_enabled,p.providers,e.kind,e.version,e.snapshot FROM bookings b JOIN whatsapp_events e ON e.id=$2 LEFT JOIN whatsapp_preferences p ON p.tenant_id=b.tenant_id WHERE b.id=$1`,[d.booking_id,d.event_id]);const b=live.rows[0];
 const cancelled=['cancelled','rejected'].includes(b?.status);
 const customer=!d.template.startsWith('provider');
 const optedOut=await query('SELECT phone FROM whatsapp_optouts WHERE phone=$1',[d.recipient]);
 const snapshotChanged=b?.snapshot && (day(b.booking_date)!==day(b.snapshot.booking_date)||String(b.booking_time).slice(0,5)!==String(b.snapshot.booking_time).slice(0,5));
 const stale=optedOut.rows.length || snapshotChanged || !b?.wa_enabled || (customer?!b.whatsapp_opt_in:!(b.providers||[]).some(p=>p.opt_in&&normalizeWhatsappNumber(p.phone)===d.recipient)) || (d.template.endsWith('cancelled')?!cancelled:['expired','completed','no_show','cancelled','rejected'].includes(b.status)) || (b.kind.startsWith('reminder_')&&(b.status!=='confirmed'||new Date(b.start_time).getTime()<=Date.now()||String(new Date(b.start_time).getTime())!==String(new Date(b.version).getTime())));
 if(stale){await query("UPDATE whatsapp_deliveries SET status='skipped',updated_at=NOW() WHERE id=$1",[d.id]);continue;}
 try{
 const body=new URLSearchParams({To:'whatsapp:'+d.recipient,From:'whatsapp:'+c.from,ContentSid:c.templates[d.template],ContentVariables:JSON.stringify(d.variables),StatusCallback:process.env.BASE_URL.replace(/\/$/,'')+'/api/v1/whatsapp/webhook'});
 const r=await api(c,'/Messages.json','post',body.toString());await query(`UPDATE whatsapp_deliveries SET message_sid=$2,status=CASE WHEN status='sending' THEN $3 ELSE status END,updated_at=NOW() WHERE id=$1`,[d.id,r.data.sid,r.data.status||'queued']);
 }catch(err){if(err.response?.status===429 && d.attempts<3){await query("UPDATE whatsapp_deliveries SET status='pending',next_attempt_at=NOW()+INTERVAL '2 minutes',error='Rate limited; safe retry scheduled',updated_at=NOW() WHERE id=$1",[d.id]);continue;}await query(`UPDATE whatsapp_deliveries SET status=$2,error=$3,updated_at=NOW() WHERE id=$1`,[d.id,err.response && err.response.status<500?'failed':'unknown',err.response?.data?.code?'Twilio error '+err.response.data.code:'Request outcome uncertain; check Twilio logs.']);}
 }
}
function startWorker(){let busy=false;const run=async()=>{if(busy)return;busy=true;try{await tick();}catch(e){console.error('[WhatsApp worker]',e.message);}finally{busy=false;}};setInterval(run,60000).unref();run();}
async function webhook(req,res){
 const c=await config();if(!c.token||!process.env.BASE_URL)return res.sendStatus(503);
 const url=process.env.BASE_URL.replace(/\/$/,'')+'/api/v1/whatsapp/webhook';
 const data=url+Object.keys(req.body).sort().map(k=>k+req.body[k]).join('');
 const expected=crypto.createHmac('sha1',c.token).update(data).digest('base64');const actual=String(req.get('X-Twilio-Signature')||'');
 if(actual.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return res.sendStatus(403);
 if(['queued','sent','delivered','read','failed','undelivered'].includes(req.body.MessageStatus)){await query(`UPDATE whatsapp_deliveries SET status=$2,error=$3,updated_at=NOW() WHERE message_sid=$1 AND status NOT IN ('read','failed','undelivered') AND (status<>'delivered' OR $2='read') AND (status<>'sent' OR $2<>'queued')`,[req.body.MessageSid,req.body.MessageStatus,req.body.ErrorCode?'Twilio error '+req.body.ErrorCode:null]);}
 if(/^stop$/i.test(String(req.body.Body||'').trim())){const phone=normalizeWhatsappNumber(req.body.From);if(phone){await query('INSERT INTO whatsapp_optouts(phone) VALUES($1) ON CONFLICT DO NOTHING',[phone]);await query(`UPDATE bookings SET whatsapp_opt_in=false WHERE regexp_replace(phone,'[^0-9]','','g') IN ($1,$2)`,[phone.slice(1),phone.slice(2)]);await query(`UPDATE whatsapp_preferences SET providers=(SELECT COALESCE(jsonb_agg(CASE WHEN r->>'phone'=$1 THEN r||'{"opt_in":false}'::jsonb ELSE r END),'[]') FROM jsonb_array_elements(providers) r)`,[phone]);}}
 res.type('text/xml').send('<Response/>');
}
// Booking events are captured transactionally by the database trigger. Retain the existing caller API without double-sending.
async function sendBookingConfirmationWhatsApp(){return {queued:true};}
module.exports={config,saveConfig,TEMPLATES,variables,normalizeWhatsappNumber,checkConnection,startWorker,webhook,sendBookingConfirmationWhatsApp,tick};
