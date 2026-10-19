/* Replace this adapter to use a cloud store; record format stays independent. */
(function(root){
  class IndicatorStorage {
    constructor(storage=root.localStorage,key='syndicate.indicatorStudio.v1'){this.storage=storage;this.key=key}
    list(){const raw=this.storage.getItem(this.key);if(!raw)return [];let records;try{records=JSON.parse(raw)}catch{throw Error('Penyimpanan Studio rusak; data belum ditimpa.')}if(!Array.isArray(records))throw Error('Format penyimpanan Studio tidak valid.');return records}
    get(id){return this.list().find(r=>r.id===id)||null}
    save(record){if(!record||typeof record.id!=='string'||typeof record.name!=='string'||!record.name.trim()||record.name.length>80||record.version!==1)throw Error('Nama atau versi indikator tidak valid.');const valid=root.SyndicateEngine.validate(record.graph,{incomplete:true});if(!valid.ok)throw Error(valid.errors.join('\n'));const records=this.list(),old=records.find(r=>r.id===record.id),now=new Date().toISOString();const next={id:record.id,name:record.name.trim(),version:1,graph:structuredClone(record.graph),createdAt:old?.createdAt||record.createdAt||now,updatedAt:now};this.storage.setItem(this.key,JSON.stringify([...records.filter(r=>r.id!==next.id),next]));return next}
    remove(id){this.storage.setItem(this.key,JSON.stringify(this.list().filter(r=>r.id!==id)))}
  }
  root.SyndicateIndicatorStorage=IndicatorStorage;if(typeof module!=='undefined')module.exports=IndicatorStorage;
})(globalThis);
