<svelte:window on:keydown={handleKeydown}/>
<script>
    import RedGreen from "../RedGreen.svelte"
    export let counter=0
    export const viewNumber=2
    export let gameString=""
    let trialSd = 3
    let numTrials =4
    let trial = 1
    let range=[...Array(viewNumber).keys()]
    let trialStartTime=Date.now()
    let viewExplore=false
    let exploitMu=15
    let exploreMu=random_int()
    let exploreSelect =false
    let exploitSelect =false
    let replaceExploit={truth:false}
    let keyView=true
    let clearBoard=false
    let currentUnderstanding=exploitMu
    let lastGreenBar=0
    let lastRedBar=0
    let greenBar = 0
    let redBar=0
    export let trialDescriptions=[]
    export let toNext
    export let bothInvisible=true
    export let breakTruth = {truth:false}
    function migrateLeftExplore(node,{delay=0,duration=500}){
        if (bothInvisible){
            return {
                 delay:0,
                duration:0}
        }
        console.log(`migrateLeftExplore:${true}`)
            return {
                delay,
                duration,
                css: (t,u)=> `transform: translateX(calc(${100*u}vw)) `
            }
    }
    function migrateLeftExploit(node,{replaceExploit,delay=0,duration=500}){
        if (bothInvisible){
                return {
                    delay:0,
                    duration:0}
            }
    console.log(`migrateLeftExploit:${replaceExploit}`)
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
        if (bothInvisible){
            return {
                 delay:0,
                duration:0}
        }
        console.log(`migrateOut:${replaceExploit}`)
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
        if (bothInvisible){
            return {
                 delay:0,
                duration:0}
        }
        console.log(`invisibleOrDown:${replaceExploit}`)
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
    async function handleKeydown(event){
        console.log(event.key)
        if (keyView==false){
            return
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight"){
            let singleTrialData={trial:trial.toString(),previousExploit:exploitMu,keyPressTime:Date.now(),trialStartTime:trialStartTime}
            bothInvisible=false
            if(event.key == "ArrowLeft"){
                greenBar+=lastGreenBar
                redBar+=lastRedBar
                lastGreenBar=0
                lastRedBar=0
                keyView=false
                let newDist=sample_normal_to_twenty()
                exploitSelect=true
                await timer(500)
                exploitSelect=false
                clearBoard=true
                await timer(1000)
                exploitMu=newDist
                lastGreenBar=newDist
                lastRedBar=20-newDist
                clearBoard=false
                keyView=true
                trialStartTime = Date.now()
                currentUnderstanding=newDist
                trial+=1
                console.log("done")
        }
        if(event.key=="ArrowRight"){
            viewExplore=true
            let newDist=random_int(20)
            greenBar+=lastGreenBar
            redBar+=lastRedBar
            lastGreenBar = 0
            lastRedBar = 0
            if (newDist > exploitMu){
                console.log("greater than")
                keyView=false
                exploreMu=newDist
                exploreSelect=true
                await timer(500)
                exploreSelect=false
                await timer(500)
                exploitMu=newDist
                viewExplore=false
                replaceExploit.truth=true
                counter+=1
                await timer(500)
                lastGreenBar=newDist
                lastRedBar=20-newDist
                keyView = true
                trialStartTime=Date.now()
                currentUnderstanding=newDist
                trial+=1
            }
        else{
            console.log("less than")
            keyView=false
            exploreMu=newDist
            exploreSelect=true
            await timer(500)
            exploreSelect=false
            await timer(500)
            viewExplore=false
            replaceExploit.truth=false
            counter+=1
            await timer(500)
            lastGreenBar=newDist
            lastRedBar=20-newDist
            keyView = true
            trialStartTime=Date.now()  
            currentUnderstanding=newDist
            trial+=1
            }
        }
        if (trial === numTrials+1){
            bothInvisible = true
        }
        else{
            bothInvisible=false
        }
        if (trial === numTrials+1){
            keyView = false
            await timer(1200)
            toNext(gameString,greenBar+lastGreenBar)
        }
        }
    }
    function box_mueller() {
    // all credit to stack exhange
        var u = 0, v = 0;
        while(u === 0) u = Math.random(); 
        while(v === 0) v = Math.random();
        return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}
    function sample_normal(mu,sd){
        return sd*box_mueller()+mu
    }
    function sample_normal_to_twenty(){
        let newNorm=Math.floor(sample_normal(exploitMu,trialSd))
        newNorm=Math.min(newNorm,20)
        newNorm=Math.max(newNorm,0)
        return newNorm
    }
    function random_int(){
        return Math.floor(20*Math.random())
    }
    //in:migrateLeft out:migrateOut
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
.descriptionText{
        text-align:center;
        width:min(90vw,180vh);
        font-size:min(3vh,3vw);
        left:max(5vw,calc((100vw - 180vh)/2));
        position:absolute;
    }
</style>
{#if !breakTruth.truth}
    {#key trial}
        <h1 class="descriptionText">{trialDescriptions[trial-1]}</h1>
    {/key}
    {#key counter}
        {#each range as i}
            {#if counter<numTrials+1}
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
                    <div style="position: absolute; left:calc(50vw + min(5vw, 5vh)); top:min(30vh,30vw)">
                    <h1 class="teachingMoves">New Teaching Move</h1>
                        <div class="greyBox" id={`box2: ${counter}`} in:migrateLeftExplore={{replaceExploit:replaceExploit}} out:InvisibleOrDown={{replaceExploit:replaceExploit}}>
                            <div style=" position: absolute">
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
            {/if}
        {/each}
    {/key}
{/if}