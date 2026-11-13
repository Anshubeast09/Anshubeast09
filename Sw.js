self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{for(const c of l){if("focus" in c)return c.focus()}return clients.openWindow("./")}))});
self.addEventListener("push",e=>{let d={};try{d=e.data.json()}catch(_){d={title:"NEXORA",body:e.data?e.data.text():"New message"}}
e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(l=>{
if(l.some(c=>c.visibilityState==="visible"))return;
return self.registration.showNotification(d.title||"NEXORA",{body:d.body||"",icon:"icon-192.png",badge:"icon-192.png",tag:d.tag||"nx",data:{url:d.url||"./"}})}))});
