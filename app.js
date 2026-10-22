'use strict';
// The application renders 24 products at a time. All names and descriptions
// are source content; only the surrounding interface is new.
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const main=$('#main'), homeMarkup=main.innerHTML;
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const money=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value)+' ₽';
const norm=value=>String(value??'').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const plural=(n,forms=['товар','товара','товаров'])=>forms[(n%100>10&&n%100<20)?2:n%10===1?0:n%10>=2&&n%10<=4?1:2];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
const savedFavorites=read('samaraplast-favorites',[]), savedCart=read('samaraplast-cart',{});
let favorites=new Set(Array.isArray(savedFavorites)?savedFavorites.map(String):[]);
let cart=savedCart&&typeof savedCart==='object'&&!Array.isArray(savedCart)?savedCart:{};
let D=null, products=new Map(), groups=new Map(), categories=new Map(), content=null;
let routeVersion=0, animationContext=null, toastTimer=null, searchTimer=null, menuGroup=null,suggestionIndex=-1;
const detailChunks=new Map();
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const reduced=()=>motionQuery.matches;
// Product photographs are ordinary HTTPS images from the original store.
// Native lazy loading and browser caching work on any static hosting service.
const photo=(id,alt,classes='',attrs='')=>{const meta=D?.media?.images[id];return `<img class="${h(classes)}" src="${h(meta?.url||'assets/photo-placeholder.svg')}" ${meta?`data-photo="${id}"`:''} alt="${h(alt)}" width="${meta?.width||480}" height="${meta?.height||480}" loading="lazy" decoding="async" referrerpolicy="no-referrer" ${attrs}>`};
function hydrate(root=main){
 for(const img of $$('img[data-photo]',root)){
  img.onload=()=>{if(!img.dataset.imageError&&img.naturalWidth>0)img.dataset.loaded='true'};
  img.onerror=()=>{
   const original=D.media.images[Number(img.dataset.photo)]?.url;
   if(original?.includes('/original/')&&img.src===original){img.src=original.replace('/original/','/prewiev/');return}
   img.dataset.imageError='true';img.src='assets/photo-placeholder.svg';img.onerror=null;
  };
  if(img.complete&&img.naturalWidth>0&&!img.dataset.imageError)img.dataset.loaded='true';
 }
}
function safeHTML(raw){
 const template=document.createElement('template');
 template.innerHTML=DOMPurify.sanitize(raw,{FORBID_TAGS:['form','input','button','iframe','script','style'],FORBID_ATTR:['style']});
 for(const nested of $$('main',template.content))nested.replaceWith(...nested.childNodes);
 for(const a of $$('a[href]',template.content)){
  const url=new URL(a.getAttribute('href'),D.source);
  if(url.protocol==='tel:'){const digits=url.pathname.replace(/\D/g,'');if(digits.length===10)a.href='tel:+7'+digits;continue}
  if(url.origin===new URL(D.source).origin&&!url.pathname.startsWith('/files/'))a.setAttribute('href',originalRoute(url.pathname));
  else if(url.protocol==='https:'||url.protocol==='http:'){a.target='_blank';a.rel='noopener'}
 }
 for(const img of $$('img',template.content)){
  const mediaId=D.contentImages?.[img.getAttribute('src')];
  if(Number.isInteger(mediaId)){img.outerHTML=photo(mediaId,img.alt||'Иллюстрация оформления заказа');continue}
  if(img.src.includes('01_1707373578')){img.src='assets/store.webp';img.alt='Посуда из ассортимента Самара-Пласт'}
  img.loading='lazy';
 }
 return template.innerHTML;
}
function originalRoute(path){
 const p=D.products.find(p=>p.path===path);if(p)return '#/product/'+p.id;
 if(path==='/')return '#/';
 if(path.startsWith('/catalog/'))return '#'+path.replace(/\/$/,'');
 return '#/'+path.replace(/^\/|\/$/g,'');
}
function counts(){
 const quantity=Object.values(cart).reduce((n,q)=>n+q,0);
 $('#cart-count').textContent=quantity;$('#favorite-count').textContent=favorites.size;$('#favorite-count').hidden=!favorites.size;
 $('button[data-open-cart]').setAttribute('aria-label',`Корзина: ${quantity} ${plural(quantity)}`);
 $('.favorites-link').setAttribute('aria-label',`Избранное: ${favorites.size} ${plural(favorites.size)}`);
 write('samaraplast-cart',cart);write('samaraplast-favorites',[...favorites]);
}
function toast(message){clearTimeout(toastTimer);$('#announcement').textContent=message;$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,4200)}
function productCard(p,{tag=''}={}){
 const liked=favorites.has(p.id);
 return `<article class="product-card" data-product="${h(p.id)}"><div class="product-visual"><a class="product-image-link" href="#/product/${h(p.id)}" tabindex="-1" aria-hidden="true">${photo(p.image,p.name,'product-photo')}</a>${tag?`<span class="product-tag">${h(tag)}</span>`:''}<button class="favorite-button" data-favorite="${h(p.id)}" aria-label="${liked?'Убрать из избранного':'Добавить в избранное'}: ${h(p.name)}" aria-pressed="${liked}">${icon('heart')}</button></div><div class="product-meta"><span>КОД ${h(p.code)}</span><span>${h(p.brand)}</span></div><h3 class="product-name"><a href="#/product/${h(p.id)}">${h(p.name)}</a></h3><div class="product-bottom"><span class="product-price">${p.oldPrice>p.price?`<del>${money(p.oldPrice)}</del>`:''}${money(p.price)}</span><button class="add-button" data-add="${h(p.id)}" aria-label="Добавить в корзину: ${h(p.name)}" ${p.stock>0?'':'disabled'}>${icon(p.stock>0?'plus':'minus')}</button></div></article>`;
}
let homeScene=null,homeRoom='kitchen',homeSet='room';
const roomData=[
 {id:'kitchen',title:'Кухня и столовая',short:'Кухня',group:'posuda',line:'ДЛЯ ВКУСНЫХ МОМЕНТОВ',picks:['1012','18869','18908']},
 {id:'bath',title:'Ванная комната',short:'Ванная',group:'prinadlejnosti-dlya-vannoy-komnaty',line:'ВРЕМЯ ДЛЯ СЕБЯ',picks:['13335']},
 {id:'storage',title:'Хранение и порядок',short:'Хранение',group:'tovar-dlya-hoznujd',category:'konteynery-dlya-hraneniya',line:'КАЖДОЙ МЕЛОЧИ — СВОЁ МЕСТО',picks:['5268','12091','5271']},
 {id:'textile',title:'Уют и текстиль',short:'Текстиль',group:'tekstil',line:'ТЕПЛО В ПРОСТЫХ ДЕТАЛЯХ',picks:['18852','18851']},
 {id:'garden',title:'Сад и дача',short:'Сад',group:'tovar-dlya-oformleniya-interera',category:'gorshki-kashpo-dlya-cvetov',line:'ПУСТЬ ДОМА БУДЕТ ЗЕЛЕНО',picks:['4828','4826','4735']},
 {id:'care',title:'Домашние дела',short:'Уборка',group:'tovar-dlya-hoznujd',category:'shvabry-i-nasadki-k-nim',line:'БОЛЬШЕ ПОРЯДКА. МЕНЬШЕ ХЛОПОТ.',picks:['14976','5848','7694']}
];
function homeSelection(){
 const room=roomData.find(r=>r.id===homeRoom)||roomData[0],key=room.group+(room.category?'/'+room.category:'');
 const list=homeSet==='room'?D.products.filter(p=>p.group===key||p.category===key):D.featured[homeSet].map(id=>products.get(id)).filter(Boolean);
 const preference=homeSet==='room'?room.picks:['18906','18869','18852'];
 const ranked=[...preference.map(id=>list.find(p=>p.id===id)).filter(p=>p&&p.image!==null),...list.filter(p=>p.image!==null&&!preference.includes(p.id))];
 const picks=ranked.slice(0,3),title=homeSet==='room'?room.title:homeSet==='new'?'Новые вещи в доме':'У каждого сезона — свои вещи';
 $('#room-kicker').textContent=homeSet==='room'?room.line:homeSet==='new'?'НОВОЕ ПОСТУПЛЕНИЕ':'ПО СЕЗОНУ';$('#room-heading').textContent=title;
 $('#room-open').href=homeSet==='room'?'#/catalog/'+key:'#/catalog?set='+homeSet;
 $('#room-finds').innerHTML=picks.map(p=>`<article class="mini-find" data-product="${h(p.id)}"><a href="#/product/${h(p.id)}" class="mini-find-photo">${photo(p.image,p.name)}</a><div class="mini-find-copy"><h3><a href="#/product/${h(p.id)}">${h(p.name)}</a></h3><span>${money(p.price)}</span></div><button class="mini-find-add" data-add="${h(p.id)}" aria-label="Добавить в корзину: ${h(p.name)}" ${p.stock>0?'':'disabled'}>${icon('plus')}</button></article>`).join('');
 $('#room-finds').removeAttribute('aria-busy');$('#room-selection-count').textContent=list.length+' '+plural(list.length)+' в подборке';
 for(const b of $$('[data-home-room]'))b.setAttribute('aria-pressed',b.dataset.homeRoom===homeRoom);
 for(const b of $$('[data-home-set]'))b.setAttribute('aria-pressed',b.dataset.homeSet===homeSet);
 hydrate($('#room-finds'));
}
function chooseHomeRoom(id){
 if(!roomData.some(r=>r.id===id)||!$('#house-stage'))return;homeRoom=id;homeSet='room';homeSelection();homeScene?.selectRoom(id);
 if(window.gsap&&!reduced())gsap.fromTo('#room-finds',{opacity:.3,y:8},{opacity:1,y:0,duration:.28,ease:'power2.out',overwrite:true});
}
function homepage(){
 main.innerHTML=homeMarkup;document.body.classList.add('view-home');
 $('#room-directory').innerHTML=roomData.map((r,i)=>`<button type="button" data-home-room="${r.id}" aria-pressed="${r.id===homeRoom}" aria-controls="room-finds"><span class="room-route-number">0${i+1}</span><span>${h(r.short)}</span>${icon('arrow')}</button>`).join('');
 $('#atlas-total').textContent=new Intl.NumberFormat('ru-RU').format(D.products.length);homeSelection();
 const host=$('#house-stage');
 import('./room-scene.js').then(({mountHome})=>{if(!host.isConnected)return;homeScene=mountHome(host,{selected:homeRoom,onSelect:chooseHomeRoom,onHover:id=>{for(const b of $$('[data-home-room]'))b.classList.toggle('is-hovered',b.dataset.homeRoom===id)}})}).catch(()=>{if(host.isConnected)host.dataset.scene='fallback'});
 $('#house-overview').addEventListener('click',()=>{homeScene?.overview()});
 if(window.gsap&&!reduced())animationContext=gsap.context(()=>{gsap.from('.atlas-title,.atlas-intro,.room-directory,.atlas-all',{y:15,opacity:0,duration:.65,stagger:.09,ease:'power3.out'});gsap.from('.room-dock',{y:20,opacity:0,duration:.65,delay:.25,ease:'power3.out'})},main);
}
document.addEventListener('click',event=>{const room=event.target.closest('[data-home-room]'),set=event.target.closest('[data-home-set]');if(room)chooseHomeRoom(room.dataset.homeRoom);if(set&&$('#house-stage')){homeSet=set.dataset.homeSet;homeSelection()}});
function breadcrumb(parts=[]){return `<nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="#/">Главная</a>${parts.map(p=>`${icon('chevron')}${p.href?`<a href="${h(p.href)}">${h(p.name)}</a>`:`<span>${h(p.name)}</span>`}`).join('')}</nav>`}
function hashCatalog(path='',params=new URLSearchParams()){
 const query=params.toString();return '#/catalog'+(path?'/'+path:'')+(query?'?'+query:'');
}
function parseRoute(){
 const hash=location.hash.replace(/^#/,'')||'/',split=hash.indexOf('?');
 return {path:(split<0?hash:hash.slice(0,split)).replace(/\/$/,'')||'/',params:new URLSearchParams(split<0?'':hash.slice(split+1))};
}
function filterProducts(key,params){
 const terms=norm(params.get('q')).split(' ').filter(Boolean),set=params.get('set'),brand=params.get('brand'),low=params.get('min'),high=params.get('max');
 let list=D.products.filter(p=>!key||p.group===key||p.category===key);
 if(set&&D.featured[set]){const ids=new Set(D.featured[set]);list=list.filter(p=>ids.has(p.id))}
 if(terms.length)list=list.filter(p=>terms.every(word=>p.search.includes(word)));
 if(brand)list=list.filter(p=>p.brand===brand);
 if(low!==null&&low!=='')list=list.filter(p=>p.price>=Number(low));
 if(high!==null&&high!=='')list=list.filter(p=>p.price<=Number(high));
 if(params.get('stock')==='1')list=list.filter(p=>p.stock>0);
 const sort=params.get('sort')||'default';
 if(sort==='price-asc')list.sort((a,b)=>a.price-b.price);
 else if(sort==='price-desc')list.sort((a,b)=>b.price-a.price);
 else if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 else if(sort==='new')list.sort((a,b)=>Number(b.id)-Number(a.id));
 else list.sort((a,b)=>Number(b.image!==null)-Number(a.image!==null)||a.name.localeCompare(b.name,'ru'));
 return list;
}
function catalogView(key,params){
 const group=groups.get(key.split('/')[0]),category=categories.get(key),q=params.get('q'),set=params.get('set');
 const title=q?`Ищем «${q}»`:({new:'Новинки',season:'Сезонные товары',sale:'Акции'}[set]||category?.name||group?.name||'Каталог товаров');
 const list=filterProducts(key,params),page=Math.min(Math.max(Number(params.get('page'))||1,1),Math.max(1,Math.ceil(list.length/24))),pages=Math.ceil(list.length/24);
 const pool=D.products.filter(p=>!key||p.group===key||p.category===key);
 const brands=[...new Set(pool.map(p=>p.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
 const options=(arr,value)=>arr.map(([id,name])=>`<option value="${h(id)}" ${id===value?'selected':''}>${h(name)}</option>`).join('');
 const subcategories=group&&!category?D.categories.filter(c=>c.group===group.id&&c.count):[];
 const pageLink=n=>{const p=new URLSearchParams(params);p.set('page',n);return hashCatalog(key,p)};
 const shownPages=[...new Set([1,...Array.from({length:3},(_,i)=>page+i-1),pages])].filter(n=>n>0&&n<=pages).sort((a,b)=>a-b);
 main.innerHTML=`<div class="container page-shell">${breadcrumb([{name:'Каталог',href:key?'#/catalog':null},...(group?[{name:group.name,href:category?'#/catalog/'+group.id:null}]:[]),...(category?[{name:category.name}]:[])])}<div class="page-heading"><div><h1>${h(title)}</h1><p class="result-count">${list.length} ${plural(list.length)}${q?' по всему каталогу':''}</p></div></div>${subcategories.length?`<div class="category-subnav">${subcategories.map(c=>`<a href="#/catalog/${h(c.id)}">${h(c.name)} <span> · ${c.count}</span></a>`).join('')}</div>`:''}<div class="catalog-layout"><aside><details class="filter-panel" ${innerWidth>960?'open':''}><summary>Фильтры ${icon('filter')}</summary><form class="filter-form" id="filter-form"><div class="filter-field"><label for="filter-group">Раздел каталога</label><select id="filter-group" name="group">${options([['','Все разделы'],...D.groups.map(g=>[g.id,g.name])],group?.id||'')}</select></div><div class="filter-field"><label for="filter-category">Категория</label><select id="filter-category" name="category">${options([['','Все категории'],...D.categories.filter(c=>!group||c.group===group.id).map(c=>[c.id,c.name])],category?.id||'')}</select></div><div class="filter-field"><label for="filter-brand">Бренд</label><select id="filter-brand" name="brand">${options([['','Все бренды'],...brands.map(b=>[b,b])],params.get('brand')||'')}</select></div><div class="filter-field"><label>Цена, ₽</label><div class="filter-price"><label class="sr-only" for="price-min">Минимальная цена</label><input id="price-min" name="min" type="number" min="0" placeholder="От" value="${h(params.get('min'))}"><label class="sr-only" for="price-max">Максимальная цена</label><input id="price-max" name="max" type="number" min="0" placeholder="До" value="${h(params.get('max'))}"></div></div><label class="checkbox-label"><input type="checkbox" name="stock" value="1" ${params.get('stock')==='1'?'checked':''}>Только в наличии</label><button type="submit" class="button button-blue">Применить фильтры ${icon('arrow')}</button><a class="filter-reset" href="${hashCatalog(key)}">Сбросить фильтры</a></form></details></aside><div class="catalog-results"><div class="catalog-toolbar"><span>${list.length?`${(page-1)*24+1}–${Math.min(page*24,list.length)} из ${list.length}`:'Ничего не найдено'}</span><label for="catalog-sort">Сортировать: <select id="catalog-sort">${options([['default','Сначала с фотографией'],['name','По названию'],['price-asc','Цена: по возрастанию'],['price-desc','Цена: по убыванию'],['new','Сначала новые']],params.get('sort')||'default')}</select></label></div>${list.length?`<div class="product-grid">${list.slice((page-1)*24,page*24).map(p=>productCard(p,{tag:set==='new'?'НОВИНКА':''})).join('')}</div>`:`<div class="empty-state"><h2>Пока ничего не нашлось.</h2><p>Попробуйте другое название, код товара или уберите часть фильтров.</p><a class="button button-blue" href="#/catalog">Открыть весь каталог ${icon('arrow')}</a></div>`}${pages>1?`<nav class="pagination" aria-label="Страницы каталога">${page>1?`<a href="${pageLink(page-1)}" aria-label="Предыдущая страница">${icon('chevron').replace('class="icon"','class="icon previous"')}</a>`:''}${shownPages.map((n,i)=>`${i&&n-shownPages[i-1]>1?'<span aria-hidden="true">…</span>':''}<a class="${n===page?'active':''}" href="${pageLink(n)}" ${n===page?'aria-current="page"':''}>${n}</a>`).join('')}${page<pages?`<a href="${pageLink(page+1)}" aria-label="Следующая страница">${icon('chevron')}</a>`:''}</nav>`:''}</div></div></div>`;
 $('#catalog-sort').addEventListener('change',event=>{const p=new URLSearchParams(params);p.set('sort',event.target.value);p.delete('page');location.hash=hashCatalog(key,p)});
 $('#filter-group').addEventListener('change',event=>location.hash=hashCatalog(event.target.value,new URLSearchParams(q?{q}:{})));
 $('#filter-category').addEventListener('change',event=>location.hash=hashCatalog(event.target.value||group?.id||'',params));
 $('#filter-form').addEventListener('submit',event=>{event.preventDefault();const form=new FormData(event.target),p=new URLSearchParams(params);for(const key of ['brand','min','max','stock']){const value=form.get(key);if(value)p.set(key,value);else p.delete(key)}p.delete('page');location.hash=hashCatalog(form.get('category')||form.get('group')||'',p)});
 hydrate();return title;
}
async function detailFor(id){
 const n=Number(id)%8;
 if(!detailChunks.has(n))detailChunks.set(n,fetch(`data/details-${n}.json?v=${D.revision||1}`).then(r=>{if(!r.ok)throw Error('details');return r.json()}).catch(e=>{detailChunks.delete(n);throw e}));
 return (await detailChunks.get(n))[id];
}
async function productView(id,version){
 const p=products.get(id);if(!p)return missingView();
 const cat=categories.get(p.category),group=groups.get(p.group);
 const detail=await detailFor(id);if(version!==routeVersion)return;
 const images=detail?.images||[];
 const related=D.products.filter(v=>v.category===p.category&&v.id!==p.id&&v.image!==null).slice(0,4);
 main.innerHTML=`<div class="container page-shell">${breadcrumb([{name:'Каталог',href:'#/catalog'},...(group?[{name:group.name,href:'#/catalog/'+p.group}]:[]),...(cat?[{name:cat.name,href:'#/catalog/'+p.category}]:[])])}<div class="product-detail"><div><div class="detail-visual">${photo(p.image,p.name,'','id="detail-main-photo"')}<button class="favorite-button" data-favorite="${h(p.id)}" aria-label="Добавить в избранное: ${h(p.name)}" aria-pressed="${favorites.has(p.id)}">${icon('heart')}</button></div>${images.length>1?`<div class="detail-thumbnails" aria-label="Фотографии товара">${images.map((image,i)=>`<button class="detail-thumbnail" data-detail-photo="${image}" aria-label="Фотография ${i+1}" aria-pressed="${i===0}">${photo(image,p.name)}</button>`).join('')}</div>`:''}</div><div class="detail-copy"><p class="detail-code">Код товара: ${h(p.code)}</p><h1>${h(p.name)}</h1>${p.brand?`<p class="detail-brand">Бренд: <strong>${h(p.brand)}</strong></p>`:''}<p class="detail-price">${money(p.price)}</p><p class="detail-stock">${p.stock>0?`${icon('check')} В наличии: ${p.stock} шт.`:'Наличие уточняется'}</p><div class="detail-purchase"><div class="quantity"><button data-detail-minus aria-label="Уменьшить количество">${icon('minus')}</button><output id="detail-quantity" aria-label="Количество">1</output><button data-detail-plus aria-label="Увеличить количество">${icon('plus')}</button></div><button class="button button-blue" data-add="${h(p.id)}" data-use-quantity ${p.stock>0?'':'disabled'}>В корзину ${icon('bag')}</button></div><div class="detail-service">${icon('truck')}<div><p>Доставка или самовывоз с Луцкой, 16</p><p>Наличие и итоговую стоимость подтвердит менеджер.</p></div></div><a class="text-link" href="#/client-individual">Доставка, оплата и возврат ${icon('up-right')}</a></div></div><div class="detail-info"><section><h2>Описание</h2><div class="description" id="product-description">${detail?.description?safeHTML(detail.description):'<p>Подробное описание можно уточнить у менеджера магазина.</p>'}</div><a class="source-link" href="${h(detail?.source||D.source+p.path)}" target="_blank" rel="noopener">Товар на официальном сайте ${icon('up-right')}</a></section><section><h2>Характеристики</h2>${detail?.specs?.length?`<dl class="specs">${detail.specs.map(([key,value])=>`<div><dt>${h(key)}</dt><dd>${h(value)}</dd></div>`).join('')}</dl>`:'<p class="description">Уточните дополнительные характеристики у менеджера магазина.</p>'}</section></div>${related.length?`<section class="related-section"><h2>Вам также может пригодиться.</h2><div class="product-grid">${related.map(p=>productCard(p)).join('')}</div></section>`:''}</div>`;
 hydrate();return p.name;
}
function favoritesView(){
 const list=[...favorites].map(id=>products.get(id)).filter(Boolean);
 main.innerHTML=`<div class="container page-shell">${breadcrumb([{name:'Избранное'}])}<div class="page-heading"><div><h1>Сохранено для дома.</h1><p class="result-count">${list.length} ${plural(list.length)}</p></div></div>${list.length?`<div class="product-grid">${list.map(p=>productCard(p)).join('')}</div>`:`<div class="empty-state">${icon('heart')}<h2>Здесь будут ваши находки.</h2><p>Нажмите на сердечко рядом с товаром, чтобы вернуться к нему позже.</p><a class="button button-blue" href="#/catalog">Найти что-нибудь для дома ${icon('arrow')}</a></div>`}</div>`;hydrate();return 'Избранное';
}
async function infoView(key,version){
 if(!content){const r=await fetch('data/content.json?v='+D.revision);if(!r.ok)throw Error('content');content=await r.json()}
 if(version!==routeVersion)return;
 const page=content[key];if(!page)return missingView();
 const links=[['about','О компании'],['client-individual','Частным покупателям'],['client-entity','Для бизнеса'],['contacts','Контакты']];
 main.innerHTML=`<div class="container page-shell">${breadcrumb([{name:page.title}])}<div class="page-heading"><h1>${h(page.title)}</h1></div><div class="info-layout"><nav class="info-nav" aria-label="Информация о магазине">${links.map(([id,name])=>`<a href="#/${id}" ${key===id?'aria-current="page"':''}>${h(name)}</a>`).join('')}</nav><article class="article info-${h(key)}">${safeHTML(page.html)}${key==='client-entity'?`<div class="recovery"><p>Обсудим условия сотрудничества.</p><a class="button button-blue" href="tel:+78463361605">Позвонить в магазин ${icon('phone')}</a></div>`:''}</article></div></div>`;hydrate();return page.title;
}
function missingView(){main.innerHTML=`<div class="container page-shell"><div class="empty-state"><h1>Эта страница не нашлась.</h1><p>Выберите нужный раздел в каталоге или вернитесь на главную.</p><a class="button button-blue" href="#/catalog">В каталог ${icon('arrow')}</a></div></div>`;return 'Страница не найдена'}
async function renderRoute({scroll=true}={}){
 if(!D)return;
 const version=++routeVersion,{path,params}=parseRoute();
 homeScene?.destroy();homeScene=null;document.body.classList.remove('view-home');
 if(animationContext){animationContext.revert();animationContext=null}
 closeSearch();closeDialog($('#catalog-dialog'));
 let title='Всё для жизни дома';
 try{
  if(path==='/')homepage();
  else if(path==='/favorites')title=favoritesView();
  else if(path==='/catalog'||path.startsWith('/catalog/'))title=catalogView(decodeURIComponent(path.slice('/catalog/'.length)),params);
  else if(path.startsWith('/product/')){main.innerHTML=`<div class="container page-shell"><p class="loading">Открываем товар…</p></div>`;title=await productView(path.split('/')[2],version)}
  else title=await infoView(path.slice(1),version);
 }catch{if(version===routeVersion){main.innerHTML=`<div class="container page-shell"><div class="empty-state"><h2>Не удалось загрузить страницу.</h2><p>Проверьте соединение и попробуйте ещё раз.</p><button class="button button-blue" id="retry-route">Повторить загрузку ${icon('arrow')}</button></div></div>`;$('#retry-route').onclick=()=>renderRoute()}}
 if(version!==routeVersion)return;
 document.title=(title||'Самара-Пласт')+' — Самара-Пласт';
 if(scroll){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true})}
 requestAnimationFrame(()=>window.ScrollTrigger?.refresh());
}
function showDialog(dialog){if(!dialog.open){dialog.showModal();document.body.style.overflowY='hidden'}closeSearch()}
function closeDialog(dialog){if(dialog.open)dialog.close()}
function menuCategories(groupId){
 const g=groups.get(groupId);if(!g)return;
 const target=$('#menu-categories');
 target.innerHTML=`<h3>${h(g.name)}</h3><a class="text-link" href="#/catalog/${h(g.id)}">Все товары раздела ${icon('arrow')}</a><div class="menu-category-grid">${D.categories.filter(c=>c.group===g.id).map(c=>`<a href="#/catalog/${h(c.id)}">${h(c.name)}<span>${c.count}</span></a>`).join('')}</div>`;
 for(const button of $$('.menu-group')){const selected=button.dataset.menuGroup===groupId;button.id='menu-tab-'+button.dataset.menuGroup;button.setAttribute('aria-selected',selected);button.tabIndex=selected?0:-1}
 target.setAttribute('aria-labelledby','menu-tab-'+groupId);
 menuGroup=groupId;
}
function openCatalog(){
 if(D){$('#catalog-menu').innerHTML=`<div class="menu-groups" role="tablist" aria-label="Разделы каталога">${D.groups.map(g=>`<button class="menu-group" role="tab" data-menu-group="${h(g.id)}" aria-selected="false" aria-controls="menu-categories">${h(g.name)}${icon('chevron')}</button>`).join('')}</div><div class="menu-categories" id="menu-categories" role="tabpanel"></div>`;menuCategories(menuGroup||D.groups[0].id)}
 showDialog($('#catalog-dialog'));$('#catalog-toggle').setAttribute('aria-expanded','true');
}
function cartItems(){return Object.entries(cart).map(([id,qty])=>({p:products.get(id),qty})).filter(item=>item.p)}
function cartSum(){return cartItems().reduce((total,item)=>total+item.p.price*item.qty,0)}
function cartView(){
 const previous=document.activeElement,hadFocus=$('#cart-body').contains(previous);
 const oldAction=previous?.dataset?.cartPlus?'cart-plus':previous?.dataset?.cartMinus?'cart-minus':previous?.dataset?.cartRemove?'cart-remove':null;
 const oldId=oldAction?previous.getAttribute('data-'+oldAction):null;
 const items=cartItems();$('#cart-heading-count').textContent=items.reduce((sum,i)=>sum+i.qty,0);
 $('#cart-body').innerHTML=items.length?`<div class="cart-items">${items.map(({p,qty})=>`<article class="cart-item">${photo(p.image,p.name)}<div><a class="cart-item-name" href="#/product/${h(p.id)}" data-close-cart-link>${h(p.name)}</a><p class="cart-item-code">Код: ${h(p.code)} · ${money(p.price)} / шт.</p><div class="cart-item-foot"><div class="quantity"><button data-cart-minus="${h(p.id)}" aria-label="Уменьшить количество: ${h(p.name)}" ${qty<=1?'disabled':''}>${icon('minus')}</button><output aria-label="Количество">${qty}</output><button data-cart-plus="${h(p.id)}" aria-label="Увеличить количество: ${h(p.name)}" ${qty>=p.stock?'disabled':''}>${icon('plus')}</button></div><span class="cart-item-price">${money(p.price*qty)}</span></div></div><button class="icon-button cart-remove" data-cart-remove="${h(p.id)}" aria-label="Удалить из корзины: ${h(p.name)}">${icon('trash')}</button></article>`).join('')}</div><div class="cart-total"><span>Итого</span><strong>${money(cartSum())}</strong></div><p class="cart-note">Без стоимости доставки. Менеджер подтвердит наличие, цену и условия получения.</p><button class="button button-blue cart-checkout" data-checkout>Подготовить заказ ${icon('arrow')}</button>`:`<div class="empty-state">${icon('bag')}<h2>Место для полезного.</h2><p>Пока здесь пусто. Самое время найти что-нибудь нужное для дома.</p><a class="button button-blue" href="#/catalog" data-close-cart-link>Перейти к покупкам ${icon('arrow')}</a></div>`;
 hydrate($('#cart-body'));
 if(hadFocus){const equivalent=oldAction?$(`#cart-body [data-${oldAction}="${oldId}"]:not(:disabled)`):null;(equivalent||$('#cart-body button:not(:disabled)')||$('#cart-dialog [data-close-dialog]')).focus({preventScroll:true})}
}
function addToCart(id,quantity,button){
 const p=products.get(id);if(!p||p.stock<=0)return;
 const was=Number(cart[id])||0,next=Math.min(was+quantity,p.stock);
 if(next===was){toast(`В корзине уже всё доступное количество: ${p.stock} шт.`);return}
 cart[id]=next;counts();
 $('#announcement').textContent=`Добавлено в корзину: ${p.name}. ${next} ${plural(next,['штука','штуки','штук'])}.`;
 if($('#cart-dialog').open)cartView();
 if(button){const before=button.innerHTML;button.innerHTML=icon('check')+(button.classList.contains('button')?' Добавлено':'');button.classList.add('added');setTimeout(()=>{if(button.isConnected){button.innerHTML=before;button.classList.remove('added')}},1300)}
 if(window.gsap&&!reduced())gsap.timeline().to('#cart-count',{scale:1.28,duration:.12,ease:'power2.out'}).to('#cart-count',{scale:1,duration:.2,ease:'power2.out'});
 $('#cart-count').setAttribute('aria-live','polite');
}
function checkoutView(){
 $('#cart-body').innerHTML=`<div class="checkout"><button class="checkout-back" data-back-cart>${icon('arrow')}Назад к корзине</button><h3>Договоримся о покупке.</h3><p class="checkout-intro">Подготовьте список и отправьте его менеджеру по почте. Он подтвердит товары, доставку и оплату.</p><form id="checkout-form" class="checkout-form" novalidate><div class="field"><label for="order-name">Ваше имя</label><input id="order-name" name="name" autocomplete="name" required aria-describedby="name-error"><span class="form-error" id="name-error"></span></div><div class="field"><label for="order-phone">Телефон для связи</label><input id="order-phone" name="phone" type="tel" autocomplete="tel" placeholder="+7 999 123-45-67" required aria-describedby="phone-error"><span class="form-error" id="phone-error"></span></div><div class="field"><label for="order-delivery">Как получить</label><select id="order-delivery" name="delivery"><option>Самовывоз: Самара, Луцкая, 16</option><option>Курьерская доставка</option><option>Транспортная компания</option></select></div><div class="field"><label for="order-comment">Город, адрес или комментарий</label><textarea id="order-comment" name="comment" autocomplete="street-address"></textarea></div><label class="checkbox-label"><input type="checkbox" name="consent" required>Согласен с <a href="https://www.samaraplast.ru/files/docs/privacy_policy_samaraplast_ru.docx" target="_blank" rel="noopener">политикой конфиденциальности</a></label><p class="form-error" id="consent-error"></p><button class="button button-blue" type="submit">Подготовить список ${icon('arrow')}</button></form></div>`;
 const consent=$('#checkout-form [name=consent]');consent.id='order-consent';consent.setAttribute('aria-describedby','consent-error');
 $('#checkout-form').addEventListener('submit',event=>{
  event.preventDefault();const f=new FormData(event.target),name=String(f.get('name')).trim(),phone=String(f.get('phone')).trim();let valid=true;
  const error=(key,message)=>{$('#'+key+'-error').textContent=message;const input=$('#order-'+key);if(input)input.setAttribute('aria-invalid',Boolean(message));if(message)valid=false};
  error('name',name.length<2?'Укажите имя, чтобы менеджер знал, как к вам обратиться.':'');
  error('phone',phone.replace(/\D/g,'').length<10?'Укажите номер телефона с кодом города или оператора.':'');
  error('consent',f.get('consent')?'':'Подтвердите согласие с политикой конфиденциальности.');
  if(!valid){$('[aria-invalid=true]',event.target)?.focus();return}
  const message=`Заказ Самара-Пласт\n\nПокупатель: ${name}\nТелефон: ${phone}\nПолучение: ${f.get('delivery')}\nКомментарий: ${f.get('comment')||'—'}\n\n`+cartItems().map(({p,qty},i)=>`${i+1}. ${p.name}\nКод: ${p.code}; ${qty} шт. × ${money(p.price)} = ${money(p.price*qty)}`).join('\n\n')+`\n\nИтого без доставки: ${money(cartSum())}\nПрошу подтвердить наличие и условия покупки.`;
  $('#cart-body').innerHTML=`<div class="order-prepared"><button class="checkout-back" data-back-cart>${icon('arrow')}Назад к корзине</button><h3>Ваш список готов.</h3><p>Отправьте его на <strong>insale@sam-plast.ru</strong> или позвоните: <a href="tel:+78463361605">+7 (846) 336-16-05</a>.</p><label class="sr-only" for="order-text">Текст заказа</label><textarea id="order-text" class="order-text" readonly>${h(message)}</textarea><div class="order-actions"><a class="button button-blue" href="mailto:insale@sam-plast.ru?subject=${encodeURIComponent('Заказ Самара-Пласт — '+name)}&body=${encodeURIComponent(message)}">Открыть почту ${icon('up-right')}</a><button class="button button-outline" id="copy-order">Копировать список</button></div><p>Заказ будет принят после подтверждения менеджером.</p></div>`;
  $('#copy-order').onclick=async()=>{try{await navigator.clipboard.writeText(message);$('#copy-order').textContent='Скопировано'}catch{$('#order-text').focus();$('#order-text').select();toast('Выделенный список можно скопировать вручную.')}};
  const heading=$('.order-prepared h3');heading.tabIndex=-1;heading.focus({preventScroll:true});
 });
 $('#order-name').focus({preventScroll:true});
}
function closeSearch(){clearTimeout(searchTimer);$('#search-results').hidden=true;$('#site-search').setAttribute('aria-expanded','false');$('#site-search').removeAttribute('aria-activedescendant');suggestionIndex=-1}
function searchSuggestions(){
 const query=$('#site-search').value.trim(),terms=norm(query).split(' ').filter(Boolean);if(!D||query.length<2){closeSearch();return}
 const list=D.products.filter(p=>terms.every(word=>p.search.includes(word))),top=list.slice(0,6),root=$('#search-results');
 suggestionIndex=-1;$('#site-search').removeAttribute('aria-activedescendant');
 root.innerHTML=top.length?top.map(p=>`<a class="search-result" role="option" id="suggestion-${h(p.id)}" tabindex="-1" aria-selected="false" href="#/product/${h(p.id)}">${photo(p.image,'')}<span>${h(p.name)}</span><strong>${money(p.price)}</strong></a>`).join('')+`<a class="search-all" role="option" id="suggestion-all" tabindex="-1" aria-selected="false" href="${hashCatalog('',new URLSearchParams({q:query}))}">Все результаты: ${list.length} ${icon('arrow')}</a>`:`<div class="search-empty" role="option" aria-disabled="true">Не нашли «${h(query)}». Попробуйте другое название или код товара.</div>`;
 root.hidden=false;$('#site-search').setAttribute('aria-expanded','true');hydrate(root);
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button'),link=event.target.closest('a');
 if(button?.dataset.favorite){
  const id=button.dataset.favorite;favorites.has(id)?favorites.delete(id):favorites.add(id);counts();
  for(const b of $$('[data-favorite]'))if(b.dataset.favorite===id){b.setAttribute('aria-pressed',favorites.has(id));b.setAttribute('aria-label',(favorites.has(id)?'Убрать из избранного: ':'Добавить в избранное: ')+products.get(id).name)}
  if(parseRoute().path==='/favorites'){favoritesView();main.focus({preventScroll:true})}
 }
 if(button?.dataset.add)addToCart(button.dataset.add,button.hasAttribute('data-use-quantity')?Number($('#detail-quantity').textContent):1,button);
 if(button?.hasAttribute('data-open-cart')){if(!D){toast('Каталог ещё загружается. Попробуйте через несколько секунд.');return}cartView();showDialog($('#cart-dialog'))}
 if(button?.hasAttribute('data-close-dialog'))closeDialog(button.closest('dialog'));
 if(button?.id==='catalog-toggle')openCatalog();
 if(button?.dataset.menuGroup)menuCategories(button.dataset.menuGroup);
 if(button?.dataset.cartMinus||button?.dataset.cartPlus){const id=button.dataset.cartMinus||button.dataset.cartPlus,p=products.get(id);cart[id]=Math.min(p.stock,Math.max(1,cart[id]+(button.dataset.cartPlus?1:-1)));counts();cartView()}
 if(button?.dataset.cartRemove){delete cart[button.dataset.cartRemove];counts();cartView()}
 if(button?.hasAttribute('data-checkout'))checkoutView();
 if(button?.hasAttribute('data-back-cart'))cartView();
 if(button?.hasAttribute('data-detail-plus')||button?.hasAttribute('data-detail-minus')){const output=$('#detail-quantity'),p=products.get(parseRoute().path.split('/')[2]);output.textContent=Math.min(Math.max(1,Number(output.textContent)+(button.hasAttribute('data-detail-plus')?1:-1)),Math.max(1,p.stock))}
 if(button?.hasAttribute('data-detail-photo')){const img=$('#detail-main-photo'),meta=D.media.images[Number(button.dataset.detailPhoto)];img.dataset.photo=button.dataset.detailPhoto;delete img.dataset.loaded;delete img.dataset.imageError;img.width=meta.width;img.height=meta.height;img.src=meta.url;for(const b of $$('.detail-thumbnail'))b.setAttribute('aria-pressed',b===button);hydrate(img.parentElement)}
 if(link?.hasAttribute('data-close-cart-link'))closeDialog($('#cart-dialog'));
 if(link&&$('#catalog-dialog').contains(link))closeDialog($('#catalog-dialog'));
 if(!event.target.closest('.search-wrap'))closeSearch();
});
for(const dialog of $$('dialog')){
 dialog.addEventListener('close',()=>{if(!$$('dialog[open]').length)document.body.style.overflowY='';if(dialog.id==='catalog-dialog')$('#catalog-toggle').setAttribute('aria-expanded','false')});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
}
$('#search-form').addEventListener('submit',event=>{event.preventDefault();const selected=$$('#search-results a')[suggestionIndex],q=$('#site-search').value.trim(),href=selected&&!$('#search-results').hidden?selected.getAttribute('href'):hashCatalog('',new URLSearchParams(q?{q}:{}));closeSearch();location.hash=href});
$('#site-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchSuggestions,180)});
$('#site-search').addEventListener('focus',()=>{if($('#site-search').value.trim().length>=2)searchSuggestions()});
$('#site-search').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)&&!$('#search-results').hidden){event.preventDefault();const options=$$('#search-results a');if(!options.length)return;suggestionIndex=(suggestionIndex+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;options.forEach((a,i)=>a.setAttribute('aria-selected',i===suggestionIndex));$('#site-search').setAttribute('aria-activedescendant',options[suggestionIndex].id);options[suggestionIndex].scrollIntoView({block:'nearest'})}if(event.key==='Escape')closeSearch()});
$('.search-wrap').addEventListener('focusout',()=>setTimeout(()=>{if(!$('.search-wrap').contains(document.activeElement))closeSearch()},0));
$('#search-results').addEventListener('keydown',event=>{const links=$$('a',$('#search-results')),index=links.indexOf(document.activeElement);if(event.key==='ArrowDown'){event.preventDefault();links[(index+1)%links.length]?.focus()}if(event.key==='ArrowUp'){event.preventDefault();if(index<=0)$('#site-search').focus();else links[index-1]?.focus()}if(event.key==='Escape'){closeSearch();$('#site-search').focus()}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='k'){event.preventDefault();$('#site-search').focus()}if(event.key==='Escape')closeSearch();if(event.target.matches('.menu-group')&&['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();const buttons=$$('.menu-group'),i=buttons.indexOf(event.target),next=buttons[(i+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+buttons.length)%buttons.length];next.focus();menuCategories(next.dataset.menuGroup)}});
window.addEventListener('hashchange',()=>renderRoute());
motionQuery.addEventListener('change',()=>{if(reduced()){window.gsap?.killTweensOf('#room-finds');if(animationContext){animationContext.revert();animationContext=null}}});
async function boot(){
 try{
  const response=await fetch('data/catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('catalog '+response.status);D=await response.json();
  products=new Map(D.products.map(p=>[p.id,p]));groups=new Map(D.groups.map(g=>[g.id,g]));categories=new Map(D.categories.map(c=>[c.id,c]));
  for(const p of D.products)p.search=norm([p.name,p.code,p.brand,categories.get(p.category)?.name].join(' '));
  favorites=new Set([...favorites].filter(id=>products.has(id)));
  cart=Object.fromEntries(Object.entries(cart).filter(([id,q])=>products.has(id)&&Number.isFinite(q)&&q>0&&products.get(id).stock>0).map(([id,q])=>[id,Math.min(products.get(id).stock,Math.floor(q))]));
  counts();if(window.gsap&&window.ScrollTrigger)gsap.registerPlugin(ScrollTrigger);
  await renderRoute({scroll:location.hash.length>2});
  $('#year').textContent=new Date().getFullYear();
  document.documentElement.dataset.ready='true';
 }catch(error){
  const target=$('#new-products')||main;target.innerHTML=`<div class="recovery"><p>Не удалось загрузить каталог. Проверьте соединение и обновите страницу.</p><button class="button button-blue" id="retry-boot">Загрузить каталог</button></div>`;$('#retry-boot').onclick=boot;
 }
}
boot();
