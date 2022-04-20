<script>
    import RedGreen from "../RedGreen.svelte"
    export let breakNav
    export let counter=0
    export const viewNumber=2
    let range=[...Array(viewNumber).keys()]
    export let delayGoodExplore=false
    export let delayBadExplore=false
    export let delayExploit = false
    export let viewExplore=false
    export let exploitMu=12
    export let exploreMu=5
    export let exploitMu2=14
    export let exploreSelect =false
    export let exploitSelect =false
    export let replaceExploit={truth:true}
    export let clearBoard=false
    export let bothInvisible={truth:true}
    export let keyDisplay = false
    export let noReplaceExplore=false
    export let pointCounter=false
    export let points=14
    export let delayTime=1000
    let invisibleExplore=false
    let keyView=keyDisplay
    if (delayGoodExplore){
        delayedGoodExplore()
    }
    if (delayBadExplore){
        delayedBadExplore()
    }
    if (delayExploit){
        delayedExploit()
    }
function migrateLeftExplore(node,{delay=0,duration=500}){
        if (bothInvisible.truth){
            return {
                delay:0,
                duration:0
            }
        }
            return {
                delay,
                duration,
                css: (t,u)=> `transform: translateX(calc(${100*u}vw)) `
            }
}
function migrateLeftExploit(node,{replaceExploit,delay=0,duration=500}){
    if (bothInvisible.truth){
            return {
                 delay:0,
                duration:0}
        }
        if (replaceExploit.truth){
            return {
                delay,
                duration,
                css: (t,u)=> `transform: translateX(min(${50*u}vw,${50*u}vh)) `
            }
        }
        else{
            return {}
        }
}
    function migrateOut(node,{replaceExploit,delay=0,duration=500}){
        if (bothInvisible.truth){
            return { 
                delay:0,
                duration:0}
        }
        if (replaceExploit.truth){
            return {
                delay,
                duration,
                css: (t,u)=> `transform: translateX(calc(${-100*u}vw)) `
        }
        }
        else{
            return {}
        }
       }
    function InvisibleOrDown(node,{replaceExploit,delay=0,duration=500}){
        if (bothInvisible.truth){
            return {
                delay:0,
                duration:0
            }
        }
        if (! replaceExploit.truth){
            return {
            delay,
            duration,
            css: (t,u)=> `transform: translateY(calc(${100*u}vh)) `
        }}
        else{
            return {
            css: ()=> `visibility: hidden;display: none;`
        }
        }
    }
    async function timer(time){
        return await new Promise(r => setTimeout(r, time));
    }

    async function delayedGoodExplore(){
        if (keyDisplay) keyView=false
        breakNav(true)
        await timer(delayTime)
        bothInvisible={truth:false}
        viewExplore=true
        exploreSelect=true
        await timer(500)
        exploreSelect=false
        await timer(1000)
        exploitMu=exploreMu
        viewExplore=false
        replaceExploit.truth=true
        counter+=1
        if (noReplaceExplore) invisibleExplore=true
        await timer(500)
        breakNav(false)
        if (keyDisplay) keyView=true
        bothInvisible={truth:true}
    }
    async function delayedBadExplore(){
        if (keyDisplay) keyView=false
        breakNav(true)
        await timer(delayTime)
        bothInvisible={truth:false}
        viewExplore=true
        exploreSelect=true
        await timer(500)
        exploreSelect=false
        await timer(1000)
        viewExplore=false
        replaceExploit.truth=false
        counter+=1
        if (noReplaceExplore) invisibleExplore=true
        await timer(500)
        breakNav(false)
        if (keyDisplay) keyView=true
        bothInvisible={truth:true}
    }
    async function delayedExploit(){
        if (keyDisplay) keyView=false
        breakNav(true)
        await timer(delayTime)
        exploitSelect=true
        bothInvisible={truth:false}
        await timer(500)
        clearBoard=true
        exploitSelect=false
        await timer(1000)
        clearBoard=false
        exploitMu=exploitMu2
        counter+=1
        breakNav(false)
        if (keyDisplay) keyView=true
        bothInvisible={truth:true}
    }
    </script>
<style>
.greyBox {
    width:min(40vw, 40vh); 
    height:min(40vw, 40vh); 
    position: absolute;
    background-color: rgb(207, 202, 202);
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid black min(.4vh,.4vw);
}
.teachingMoves {
    top:max(-10vh, -10vw); 
    left:max(-5vh,-5vw) ;
    width: min(50vw,50vh); 
    height:min(5vh,5vw); 
    position: absolute; 
    text-align:center; 
    font-size: min(3vh,3vw)
}
.blueLight {
    width:min(45vh,45vw); 
    height:min(45vh,45vw); 
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid blue 5px;
    top: max(-2.5vh,-2.5vw); 
    left: max(-2.5vw,-2.5vh); 
    position: absolute;
}
.arrowKey {
    text-align:center;
    width:min(30vh,30vw);
    height:min(5vh,5vw);
    font-size:min(3vw, 3vh);
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid black min(.4vh,.4vw);
}
.arrowCover {
    top:min(60vh,60vw); 
    width:min(40vh,40vw);
    display:flex; 
    justify-content:center; 
    position: absolute;
}
</style>
{#key counter}
    {#if pointCounter}
        <h1 style="position: absolute; top:0vh; left:calc(50vw + -400px); width:800px; height:50px; text-align:center; border:solid black 2px">Current Classroom Understanding: {Math.round(points/20*100)}%</h1>
    {/if}
    {#each range as i}
        {#if i==0}
            <div style=" position: absolute; left:calc(50vw - min(45vw, 45vh)); top:min(30vh,30vw);">
            <h1 class="teachingMoves">Current Teaching Move</h1>
            <div class = "blueLight" style="opacity: {(!exploitSelect)?"0":"1"};"></div>
                <div class="greyBox" id={`box1: ${counter}`} in:migrateLeftExploit={{replaceExploit:replaceExploit}} out:migrateOut={{ replaceExploit: replaceExploit}}>
                    <div style="top:0px; position: absolute">
                        {#if !clearBoard}
                            <RedGreen numberGreen={exploitMu}/>
                        {:else}
                            <RedGreen numberGreen={0} clearBoard={true}/>
                        {/if}
                    </div>
                </div>
            {#if keyView}
                <div class = "arrowCover">
                    <h2 class = "arrowKey">Left Arrow</h2>
                </div>
            {/if}
            </div>
            {:else}
            <div style=" position: absolute; left:calc(50vw + min(5vw, 5vh)); top:min(30vh,30vw)">
            <h1 class="teachingMoves">New Teaching Move</h1>
            <div class="greyBox" id={`box2: ${counter}`} in:migrateLeftExplore={{replaceExploit:replaceExploit}} out:InvisibleOrDown={{replaceExploit:replaceExploit}}>
                <div style="top: 0px; position: absolute">
                    {#if viewExplore}
                        <RedGreen numberGreen={exploreMu}/>
                    {:else}
                        <div style="width: min(40vh,40vw); height:min(40vh,40vw); text-align: center; font-size: min(20vh,20vw); top: min(5vh,5vw); position:absolute">?</div>
                    {/if}
                </div>
                </div>
                <div class="blueLight" style="opacity: {(!exploreSelect)?"0":"1"};"></div>
        {#if keyView}
                <div class ="arrowCover">
                <h2 class = "arrowKey">Right Arrow</h2>
            </div>
        {/if}
        </div>
        {/if}
    {/each}
{/key}