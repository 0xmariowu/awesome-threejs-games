import{n as e}from"./C47JuxvO.js";import{a as t}from"./BW6YWG0R.js";import{t as n}from"./DLabtpBR.js";import{t as r}from"./DrDnj3Lb.js";import{u as i}from"./ClujFw2l.js";import{t as a}from"./BeAPK0YT.js";import{t as o}from"./C6MU3C_D.js";import{t as s}from"./DD-GXkCJ.js";var c=e(s(),1),l=class extends n{constructor(){super(),this.Matter=c.default,this.content=a.behindTheScene,this.techCards=this.content.techCards,this.engine=null,this.runner=null,this.bodiesMap=new Map,this.physicsContainer=null,this.isPhysicsStarted=!1,this.isPhysicsInitialized=!1,this.walls=[],this.pointerListeners=null,this.bgVideo=null,this.init()}init(){typeof document>`u`||(this.initDOM(),this.bindEvents())}initDOM(){let e=this.content,t=e.thanks,n=e.sections,r=e.footer,a=e.modal,o=i({className:`bts-page__close-button`,ariaLabel:a.closeAriaLabel,hasBackground:!0}),s=this.initRoot(`div`,`bts-page`,{role:`dialog`,"aria-modal":`true`,"aria-label":a.ariaLabel}),c=n.tools.items.map(e=>`<p><strong>${e.tool}</strong>: ${e.description}</p>`).join(``);s.innerHTML=`
      <div class="bts-page__header">
        ${o}
      </div>

      <div class="bts-page__scroll-container">
        <section class="bts-page__thanks-section">
          <div class="bts-page__video-container">
            <video
              class="bts-page__video-bg"
              autoplay
              loop
              muted
              playsinline
              webkit-playsinline
              preload="auto"
              aria-hidden="true"
              tabindex="-1"
            >
              <source src="${t.videoWebm||t.videoSrc||`/assets/videos/bts-page-1080p.webm`}" type="video/webm" />
              <source src="${t.videoMp4||`/assets/videos/bts-page-1080p.mp4`}" type="video/mp4" />
            </video>
            <div class="bts-page__video-overlay"></div>
          </div>

          <div class="bts-page__thanks-top">
            <h1 class="u-visually-hidden">Behind The Scenes</h1>
            <img src="/assets/elements/hud/title-bts.svg" alt="${t.titleAlt}" class="bts-page__title-img" width="572" height="207" />
            <span class="bts-page__tag bts-page__tag--desktop">${t.tag}</span>
          </div>

          <div class="bts-page__thanks-bottom">
            <div class="bts-page__thanks-bottom-left">
              <a href="#bts-content" class="bts-page__more-link">${t.moreBelow}</a>
            </div>
            <div class="bts-page__thanks-bottom-right">
              <p class="bts-page__thanks-text">
                ${t.text}
              </p>
              <div class="bts-page__thanks-mobile-footer">
                <a href="#bts-content" class="bts-page__more-link bts-page__more-link--mobile">${t.moreBelow}</a>
                <span class="bts-page__tag bts-page__tag--mobile">${t.tag}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="bts-page__main-layout">
          <section class="bts-page__content-section" id="bts-content">
            <h2 class="u-visually-hidden">Technical Insights & Architecture</h2>
            <article class="bts-page__block">
              <div class="bts-page__block-header">
                <h3 class="bts-page__block-title">${n.ui.title}</h3>
                <p class="bts-page__block-desc">
                  ${n.ui.description}
                </p>
              </div>
              <div class="bts-page__img-container">
                <div class="bts-page__img-placeholder bts-page__img-placeholder--ui"></div>
              </div>
            </article>

            <article class="bts-page__block">
              <div class="bts-page__block-header">
                <h3 class="bts-page__block-title">${n.rendering3d.title}</h3>
                <p class="bts-page__block-desc">
                  ${n.rendering3d.description}
                </p>
              </div>
              <div class="bts-page__img-container">
                <div class="bts-page__img-placeholder bts-page__img-placeholder--3d"></div>
              </div>
            </article>

            <article class="bts-page__block">
              <div class="bts-page__block-header">
                <h3 class="bts-page__block-title">${n.sounds.title}</h3>
                <p class="bts-page__block-desc">
                  ${n.sounds.description}
                </p>
              </div>
            </article>

            <article class="bts-page__block">
              <div class="bts-page__block-header">
                <h3 class="bts-page__block-title">${n.tools.title}</h3>
                <div class="bts-page__tools-list">
                  ${c}
                </div>
              </div>
            </article>

            <article class="bts-page__block bts-page__block--source">
              <div class="bts-page__block-header">
                <h3 class="bts-page__block-title">${n.sourceCode.title}</h3>
                <div class="bts-page__source-content">
                  <p class="bts-page__block-desc">
                    ${n.sourceCode.description}
                  </p>
                  <div class="bts-page__cta-wrap">
                    <button class="ui-button ui-button--cta ui-button--md bts-page__cta-button">
                      <span class="ui-button__label">${n.sourceCode.ctaLabel}</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <footer class="bts-page__footer">
              <span>${r.love}</span>
              <span>${r.author}</span>
            </footer>
          </section>

          <section class="bts-page__uth-section" id="bts-uth-section">
            <h2 class="bts-page__uth-title">${e.uthTitle}</h2>
            <div class="bts-page__physic-area" id="bts-physic-area"></div>
          </section>
        </div>
      </div>
    `,document.body.appendChild(s),this.closeButton=this.query(`.bts-page__close-button`),this.physicsContainer=this.query(`#bts-physic-area`),this.bgVideo=this.query(`.bts-page__video-bg`),this.queryAll(`.bts-page__more-link`).forEach(e=>{this.bindClick(e,e=>{e.preventDefault(),this.lenis&&this.lenis.scrollTo(`#bts-content`)})}),this.initModal({overlay:this.root,panel:this.root,lockKey:`bts_page`,display:`block`,route:`/behind-the-scene`,pageTitle:a.pageTitle,pageDescription:a.pageDescription,noindex:!0,pauseRender:!0})}bindEvents(){this.closeButton&&this.bindClick(this.closeButton,()=>this.close()),this.subscribe(`page:bts:open`,()=>this.open()),this.subscribe(`page:bts:close`,()=>this.close()),this.listenDOM(window,`resize`,()=>{this.isOpen()&&this.handleResize()})}onBeforeOpen(){t.emit(`title:set`,`BEHIND THE SCENE`),this.bgVideo&&(this.bgVideo.muted=!0,this.bgVideo.defaultMuted=!0,this.bgVideo.playsInline=!0,this.bgVideo.play().catch(()=>{})),this.initLenis(),this.addTimeout(()=>{this.initPhysics(),this.handleScroll()},150)}onBeforeClose(){this.bgVideo&&this.bgVideo.pause(),this.destroyLenis(),this.destroyPhysics()}initLenis(){let e=this.query(`.bts-page__scroll-container`);e&&(this.lenis=new o({wrapper:e,content:e.firstElementChild,smooth:!0,duration:1.2,easing:e=>Math.min(1,1.001-2**(-10*e))}),this.lenis.on(`scroll`,()=>this.handleScroll()),this.onTickerUpdate=e=>{this.lenis&&this.lenis.raf(e*1e3)},r.ticker.add(this.onTickerUpdate))}destroyLenis(){this.onTickerUpdate&&=(r.ticker.remove(this.onTickerUpdate),null),this.lenis&&=(this.lenis.destroy(),null)}handleScroll(){this.isPhysicsStarted||!this.physicsContainer||this.physicsContainer.getBoundingClientRect().top<window.innerHeight&&this.startPhysics()}handleResize(){if(!this.physicsContainer||!this.engine)return;let e=this.physicsContainer.clientWidth||560,t=this.physicsContainer.clientHeight||450;this.currentWidth=e,this.currentHeight=t;let n=[{x:e/2,y:t+200/2},{x:e/2,y:-200/2},{x:-200/2,y:t/2},{x:e+200/2,y:t/2}];this.walls.forEach((e,t)=>{e&&this.Matter.Body.setPosition(e,n[t])})}initPhysics(){if(!this.physicsContainer||this.isPhysicsInitialized)return;this.isPhysicsInitialized=!0;let e=this.physicsContainer.clientWidth||560,t=this.physicsContainer.clientHeight||450;this.currentWidth=e,this.currentHeight=t;let n=e<480,r=n?Math.max(.68,e/480):1;this.engine=this.Matter.Engine.create({gravity:{x:0,y:.9},positionIterations:6,velocityIterations:4,enableSleeping:!0});let i={isStatic:!0,friction:.6,frictionStatic:1,restitution:.2};this.walls=[this.Matter.Bodies.rectangle(e/2,t+200/2,e*4,200,i),this.Matter.Bodies.rectangle(e/2,-200/2,e*4,200,i),this.Matter.Bodies.rectangle(-200/2,t/2,200,t*4,i),this.Matter.Bodies.rectangle(e+200/2,t/2,200,t*4,i)],this.Matter.Composite.add(this.engine.world,this.walls),this.physicsContainer.innerHTML=``,this.bodiesMap.clear(),this.techCards.forEach((t,i)=>{let a=document.createElement(`a`);a.className=`bts-page__tech-card bts-page__tech-card--${t.id}`,a.href=t.url||`#`,a.target=`_blank`,a.rel=`noopener noreferrer`,a.setAttribute(`draggable`,`false`),a.setAttribute(`aria-label`,`${t.label} link`);let o=Math.round(t.width*r),s=Math.round(t.height*r);a.style.cssText=`width:${o}px;height:${s}px;${n?`padding:1.2rem;font-size:1.4rem;`:``}`,a.innerHTML=`<span>${t.label}</span>`;let c=0,l=0,u=0,d=!1;a.addEventListener(`dragstart`,e=>e.preventDefault()),a.addEventListener(`pointerdown`,e=>{c=e.clientX,l=e.clientY,u=Date.now(),d=!1}),a.addEventListener(`pointermove`,e=>{u&&Math.hypot(e.clientX-c,e.clientY-l)>12&&(d=!0)}),a.addEventListener(`pointerup`,e=>{let n=Math.hypot(e.clientX-c,e.clientY-l),r=Date.now()-u;u=0,!d&&n<12&&r<400&&t.url&&(e.pointerType===`touch`||e.pointerType===`pen`)&&window.open(t.url,`_blank`,`noopener,noreferrer`)}),a.addEventListener(`click`,e=>{if(d){e.preventDefault(),e.stopPropagation();return}(e.pointerType===`touch`||e.pointerType===`pen`)&&e.preventDefault()}),this.physicsContainer.appendChild(a);let f=e/2*(i%2)+e/4,p=35+Math.floor(i/2)*55,m=this.Matter.Bodies.rectangle(f,p,o,s,{restitution:.2,friction:.5,frictionStatic:.7,frictionAir:.035,density:.002,angle:t.angle});this.Matter.Composite.add(this.engine.world,m),this.bodiesMap.set(m,{element:a,width:o,height:s})});let a=this.Matter.Mouse.create(this.physicsContainer);a.element&&[`mousemove`,`mousedown`,`mouseup`,`mousewheel`,`DOMMouseScroll`,`touchstart`,`touchmove`,`touchend`].forEach(e=>a.element.removeEventListener(e,a[e]||a.mousewheel)),this.mouseConstraint=this.Matter.MouseConstraint.create(this.engine,{mouse:a,constraint:{stiffness:.8,damping:.15,angularStiffness:.8,render:{visible:!1}}});let o=null,s=(e,t)=>{if(!this.physicsContainer)return;(!o||e.type.includes(`down`))&&(o=this.physicsContainer.getBoundingClientRect()),a.position.x=e.clientX-o.left,a.position.y=e.clientY-o.top,t!==void 0&&(a.button=t);let n=e.type.includes(`down`)?`mousedown`:`mousemove`;a.sourceEvents[n]=e};this.onPointerDown=e=>{this.bodiesMap.forEach((e,t)=>this.Matter.Sleeping.set(t,!1)),s(e,0)},this.onPointerMove=e=>s(e),this.onPointerUp=()=>{a.button=-1,o=null,this.mouseConstraint&&(this.mouseConstraint.body=null)},this.pointerListeners=[[this.physicsContainer,`pointerdown`,this.onPointerDown],[window,`pointermove`,this.onPointerMove],[window,`pointerup`,this.onPointerUp],[window,`pointercancel`,this.onPointerUp]],this.pointerListeners.forEach(([e,t,n])=>e.addEventListener(t,n,{passive:!0})),this.Matter.Events.on(this.mouseConstraint,`startdrag`,({body:e})=>{e&&(this.Matter.Sleeping.set(e,!1),this.bodiesMap.forEach((e,t)=>this.Matter.Sleeping.set(t,!1)))}),this.Matter.Events.on(this.mouseConstraint,`enddrag`,({body:e})=>{e&&(this.Matter.Body.setVelocity(e,{x:Math.max(-16,Math.min(16,e.velocity.x)),y:Math.max(-16,Math.min(16,e.velocity.y))}),this.Matter.Body.setAngularVelocity(e,Math.max(-.15,Math.min(.15,e.angularVelocity))))}),this.Matter.Composite.add(this.engine.world,this.mouseConstraint),this.Matter.Events.on(this.engine,`beforeUpdate`,()=>{let e=this.currentWidth||560,t=this.currentHeight||450;this.bodiesMap.forEach((n,r)=>{let{x:i,y:a}=r.position;if(i<-150||i>e+150||a>t+150||a<-150){let t=Math.max(50,Math.min(e-50,e/2));this.Matter.Body.setPosition(r,{x:t,y:50}),this.Matter.Body.setVelocity(r,{x:0,y:1}),this.Matter.Body.setAngularVelocity(r,0)}})}),this.runner=this.Matter.Runner.create({isFixed:!0,delta:1e3/60}),this.Matter.Events.on(this.engine,`afterUpdate`,()=>this.updatePhysicsDOM()),this.updatePhysicsDOM()}startPhysics(){this.isPhysicsStarted||!this.engine||!this.runner||(this.isPhysicsStarted=!0,this.Matter.Runner.run(this.runner,this.engine))}updatePhysicsDOM(){this.bodiesMap.forEach(({element:e,width:t,height:n},r)=>{let{x:i,y:a}=r.position,o=r.angle;e.style.transform=`translate3d(${i-t/2}px, ${a-n/2}px, 0px) rotate(${o}rad)`})}destroyPhysics(){this.pointerListeners&&=(this.pointerListeners.forEach(([e,t,n])=>e.removeEventListener(t,n)),null),this.runner&&=(this.Matter.Runner.stop(this.runner),null),this.engine&&=(this.mouseConstraint&&=(this.Matter.Composite.remove(this.engine.world,this.mouseConstraint),null),this.Matter.World.clear(this.engine.world,!1),this.Matter.Engine.clear(this.engine),null),this.walls=[],this.bodiesMap.clear(),this.isPhysicsStarted=!1,this.isPhysicsInitialized=!1}dispose(){this.bgVideo&&=(this.bgVideo.pause(),this.bgVideo.removeAttribute(`src`),this.bgVideo.load(),null),this.destroyLenis(),this.destroyPhysics(),super.dispose(),this.closeButton=null,this.physicsContainer=null}};export{l as default};