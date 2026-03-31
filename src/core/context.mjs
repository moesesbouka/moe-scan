export const LSKEY='crazymoe_v5';
export const LSKEY_B='crazymoe_bulk_v2';
export const LSKEY_OFFLINE='crazymoe_offline_q';
export const $=id=>document.getElementById(id);
export const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));

export const S={step:1,lookupQuery:'',results:[],selected:null,photos:[],
  settings:{url:'',key:'',table:'active_listings',bucket:'listing-photos',folder:'scanner-intake',
    discount:'',fbMode:'auto',city:'Buffalo, NY',storeName:'CrazyMoe'},
  drafts:[],savedItems:[],draft:null,offlineQueue:[],
  camFacing:'environment',camStream:null,camTrack:null,torchOn:false,
  scanner:null,scanning:false,dashTab:'drafts',dashSearch:''};

export const B={queue:[],processing:false,pause:false,editId:null,filter:'all',
  sel:new Set(),beCam:null,beFacing:'environment',fbQ:[],fbQIdx:0};
