const axios=require('axios');
const SENDERS_URL='https://messaging.twilio.com/v2/Channels/Senders';
function publicOrigin(env=process.env){
 for(const value of [env.PUBLIC_APP_URL,env.BASE_URL,'https://icssbookings.com']){
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|\[::1\])/.test(u.hostname)&&!u.hostname.endsWith('.internal')&&!u.hostname.endsWith('.local'))return u.origin;}catch{}
 }
 return 'https://icssbookings.com';
}
function callbackUrl(c={},env=process.env){return c.callback_url||publicOrigin(env)+'/api/v1/whatsapp/webhook';}
async function configureSender(c){
 const options={auth:{username:c.sid,password:c.token},timeout:15000};
 let url=SENDERS_URL+'?Channel=whatsapp&PageSize=100';let sender;
 for(let page=0;url&&page<20;page++){
  const r=await axios({...options,url,method:'get'});
  sender=(r.data.senders||[]).find(s=>s.sender_id==='whatsapp:'+c.from);
  if(sender)break;
  const next=r.data.meta?.next_page_url;
  // Never forward account credentials to an arbitrary pagination host.
  url=next&&next.startsWith(SENDERS_URL+'?')?next:null;
 }
 if(!sender||!/^XE[a-f0-9]{32}$/i.test(sender.sid))throw new Error('The sender number is not registered for WhatsApp in this Twilio account. Check the account and sender number.');
 if(!['ONLINE','ONLINE:UPDATING'].includes(sender.status))throw new Error('Your WhatsApp sender is not online yet. Complete its registration in Twilio, then save again.');
 const target=callbackUrl(c);
 const webhook={callback_url:target,callback_method:'POST',status_callback_url:target,status_callback_method:'POST'};
 await axios({...options,url:SENDERS_URL+'/'+sender.sid,method:'post',headers:{'Content-Type':'application/json'},data:{webhook}});
 return {sender_sid:sender.sid,callback_url:target,webhook_configured_at:new Date().toISOString()};
}
module.exports={publicOrigin,callbackUrl,configureSender};
