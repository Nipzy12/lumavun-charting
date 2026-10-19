/* Chunked historical cache. IndexedDB is used in browsers; tests and restricted contexts use memory. */
(function(root){
  class HistoricalCache{
    constructor({dbName='syndicate-market-history-v1',maxBars=250000,chunkSize=1000}={}){this.dbName=dbName;this.maxBars=maxBars;this.chunkSize=chunkSize;this.memory=new Map();this.dbPromise=null}
    async database(){
      if(!root.indexedDB)return null;if(this.dbPromise)return this.dbPromise;
      this.dbPromise=new Promise((resolve,reject)=>{const request=indexedDB.open(this.dbName,1);request.onupgradeneeded=()=>{const db=request.result,store=db.createObjectStore('chunks',{keyPath:'id'});store.createIndex('series','series');store.createIndex('usedAt','usedAt')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)}).catch(()=>null);return this.dbPromise;
    }
    async records(series){
      const db=await this.database();if(!db)return [...this.memory.values()].filter(r=>r.series===series);
      return new Promise(resolve=>{const tx=db.transaction('chunks','readonly'),request=tx.objectStore('chunks').index('series').getAll(series);request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>resolve([])});
    }
    async get(series){const rows=(await this.records(series)).sort((a,b)=>a.usedAt-b.usedAt),bars=SyndicateMarketAdapters.normalize(rows.flatMap(r=>r.bars));if(rows.length)this.touch(rows).catch(()=>{});return bars}
    async put(series,bars){
      bars=SyndicateMarketAdapters.normalize(bars);if(!bars.length)return;
      const chunks=[];for(let i=0;i<bars.length;i+=this.chunkSize){const part=bars.slice(i,i+this.chunkSize),first=part[0].time,last=part.at(-1).time;chunks.push({id:`${series}:${first}:${last}`,series,first,last,bars:part,usedAt:Date.now(),count:part.length})}
      const db=await this.database();if(!db){for(const item of chunks)this.memory.set(item.id,item);this.evictMemory();return}
      await new Promise(resolve=>{const tx=db.transaction('chunks','readwrite'),store=tx.objectStore('chunks');for(const item of chunks)store.put(item);tx.oncomplete=resolve;tx.onerror=resolve});this.evict().catch(()=>{});
    }
    async touch(rows){const db=await this.database();if(!db){for(const row of rows){row.usedAt=Date.now();this.memory.set(row.id,row)}return}await new Promise(resolve=>{const tx=db.transaction('chunks','readwrite'),store=tx.objectStore('chunks');for(const row of rows){row.usedAt=Date.now();store.put(row)}tx.oncomplete=resolve;tx.onerror=resolve})}
    evictMemory(){let rows=[...this.memory.values()].sort((a,b)=>a.usedAt-b.usedAt),total=rows.reduce((n,r)=>n+r.count,0);for(const row of rows){if(total<=this.maxBars)break;this.memory.delete(row.id);total-=row.count}}
    async evict(){const db=await this.database();if(!db)return this.evictMemory();const rows=await new Promise(resolve=>{const r=db.transaction('chunks').objectStore('chunks').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>resolve([])});let total=rows.reduce((n,r)=>n+r.count,0);if(total<=this.maxBars)return;await new Promise(resolve=>{const tx=db.transaction('chunks','readwrite'),store=tx.objectStore('chunks');for(const row of rows.sort((a,b)=>a.usedAt-b.usedAt)){if(total<=this.maxBars)break;store.delete(row.id);total-=row.count}tx.oncomplete=resolve;tx.onerror=resolve})}
    async clear(series){const rows=await this.records(series),db=await this.database();if(!db){for(const row of rows)this.memory.delete(row.id);return}await new Promise(resolve=>{const tx=db.transaction('chunks','readwrite'),store=tx.objectStore('chunks');for(const row of rows)store.delete(row.id);tx.oncomplete=resolve;tx.onerror=resolve})}
  }
  root.SyndicateHistoricalCache=HistoricalCache;if(typeof module!=='undefined')module.exports=HistoricalCache;
})(globalThis);
