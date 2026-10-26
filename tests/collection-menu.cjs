const assert=require('node:assert/strict'),fs=require('node:fs'),menu=require('../static/collection-menu');
const registry=require('../static/constellations').definitions;
const items=menu.entries([{value:'all',textContent:'Tous les objets'},...registry.map(row=>({value:row.id,textContent:row.label}))]);
assert.equal(items[0].value,'all');assert.equal(items.length,registry.length+1);
for(let i=2;i<items.length;i++)assert.ok(items[i-1].label.localeCompare(items[i].label,'fr',{sensitivity:'base',numeric:true})<=0);
assert.equal(items[menu.match(items,'galil',0)].value,'galileo');assert.equal(items[menu.match(items,'pléiades neo',0)].value,'pleiades-neo');
class Node{
 constructor(){this.children=[];this.attrs={};this.events={};this.hidden=false;this.scrollTop=0;this.clientTop=0;this.clientHeight=120;this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}
 addEventListener(event,fn){this.events[event]=fn;}getBoundingClientRect(){return this.box||{top:0,height:20};}scrollIntoView(){throw Error('Interdit : déplacement de la page');}focus(){}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 querySelector(){return this.label;}dispatchEvent(event){this.lastEvent=event.type;}
}
const doc=new Node();doc.createElement=()=>new Node();global.document=doc;
const select=new Node(),nav=new Node();nav.label=new Node();nav.append(select);select.parentElement=nav;select.options=items.filter(item=>item.value==='all'||JSON.parse(fs.readFileSync('resources/collection-baseline.json')).existing_group_ids.includes(item.value)).map(item=>({value:item.value,textContent:item.label}));select.value='starlink';
menu.mount(select);const button=nav.children[1],panel=nav.children[2],list=panel.children[1];
assert.equal(select.hidden,true);assert.equal(button.textContent,'Starlink');assert.equal(panel.hidden,true);
const key=(key,target=button,extra={})=>doc.events.keydown({key,target,preventDefault(){},stopPropagation(){},...extra});
button.events.click();assert.equal(button.attrs['aria-expanded'],'true');
key('g');assert.equal(button.attrs['aria-activedescendant'],'collection-option-galileo');
key('Enter');assert.equal(select.value,'galileo');assert.equal(select.lastEvent,'change');assert.equal(panel.hidden,true);
key('ArrowDown');key('ArrowDown');key('Enter');assert.equal(select.value,'gaofen-3');
key('g');assert.equal(button.attrs['aria-activedescendant'],'collection-option-galileo');key('g');assert.equal(button.attrs['aria-activedescendant'],'collection-option-gaofen-3');
key('Escape');assert.equal(panel.hidden,true);assert.equal(select.value,'gaofen-3');
key('End');key('Enter');assert.equal(select.value,menu.entries(select.options).at(-1).value);
button.events.click();key('Tab');assert.equal(panel.hidden,true);
button.events.click();doc.events.pointerdown({target:new Node()});assert.equal(panel.hidden,true);
button.events.click();
nav.events.focusout({relatedTarget:null});assert.equal(panel.hidden,false);
list.box={top:100,height:120};list.children.find(group=>group.attrs['aria-label']==='E').children[0].box={top:300,height:30};
key('e',list);assert.equal(button.attrs['aria-activedescendant'],'collection-option-earthcare');
assert.equal(list.scrollTop,200);
key('r',list);assert.equal(button.attrs['aria-activedescendant'],'collection-option-radarsat-constellation');
key('d',list);assert.equal(button.attrs['aria-activedescendant'],'collection-option-debris');
key('e',{closest:()=>true});assert.equal(button.attrs['aria-activedescendant'],'collection-option-debris');
key('r',list,{ctrlKey:true});assert.equal(button.attrs['aria-activedescendant'],'collection-option-debris');
key('e',list,{isComposing:true});assert.equal(button.attrs['aria-activedescendant'],'collection-option-debris');
key('Escape',list);assert.equal(panel.hidden,true);
key('r',list);assert.equal(panel.hidden,true);
assert.ok(list.children.some(group=>group.attrs['aria-label']==='G'&&group.children[0].textContent==='G'));
const html=fs.readFileSync('static/index.html','utf8');assert.ok(html.indexOf('/collection-menu.js?')<html.indexOf('/app.js?'));
console.log('Menu personnalisé : 98 pages triées, repères alphabétiques, lettres répétées, flèches, Entrée, Échap, Tab et clic extérieur OK.');
