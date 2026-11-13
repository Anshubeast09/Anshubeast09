self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if("focus" in c)return c.focus()}return clients.openWindow("./")}))});
self.addEventListener("push",e=>{
let d={};try{d=e.data.json()}catch(_){d={sender:"NEXORA",text:e.data?e.data.text():"New message"}}
const sender=d.sender||d.title||"NEXORA",text=d.text||d.body||"";
e.waitUntil((async()=>{
const wins=await clients.matchAll({type:"window",includeUncontrolled:true});
if(wins.some(c=>c.visibilityState==="visible"))return;
const old=await self.registration.getNotifications({tag:"nx-chat"});
const prev=old.length&&old[0].data?old[0].data:{lines:[],count:0};
const lines=[...prev.lines,sender+": "+text].slice(-5),count=prev.count+1;
const title=d.mention?sender+" mentioned you":count>1?"NEXORA ("+count+" new messages)":"NEXORA";
await self.registration.showNotification(title,{body:lines.join("\n"),icon:"icon-192.png",badge:"icon-192.png",tag:"nx-chat",renotify:true,vibrate:[200,100,200],timestamp:Date.now(),data:{lines,count}});
if(self.navigator.setAppBadge)self.navigator.setAppBadge(count).catch(()=>{});
})())});
