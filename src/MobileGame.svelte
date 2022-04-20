<script>
    import RedGreen from "./RedGreen.svelte"
    export let counter=0
    //export let top="50px"
    //export let left ="200px"
    export const viewNumber=2
    export let gameString=""
    let trialSd = 3
    export let numTrials =30
    let trial = 1
    let range=[...Array(viewNumber).keys()]
    let trialStartTime=Date.now()
    let viewExplore=false
    let exploitMu=random_int()
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
    let trialHandle = false
    export let toNext
    export let server
    export let id
    export let bothInvisible=true
    export let block
    export let totalBlocks
    console.log(gameString)
    //$: oldExploit =replaceExploit
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
    async function Send_Data_To_Exius(params,templateKey,writeKey){
    // [{endpoint:Horizon_CSV,data:data,fname:fname}]
    try{
        var fd=new FormData()
        for ( const fileInfo of params){
            let URL = new Blob([fileInfo.data], { type: 'text/csv;charset=utf-8;' });
            fd.append(fileInfo.endpoint,URL,fileInfo.fname)
        }
        let res = await fetch("https://exius.nrdlab.org/Upload",{
            headers:{authorization:`templateKey:${templateKey};writeKey:${writeKey}`},
            method:"POST",
            body: fd})
        return await res.json()}
    catch(e){
        throw e
    }}
    async function handleButton(side){
        if (keyView==false || trialHandle){
            return
        }
        trialHandle = true
        if (trial >= numTrials){
            keyView = false
        }
        let singleTrialData={trial:trial.toString(),previousExploit:exploitMu,keyPressTime:Date.now(),trialStartTime:trialStartTime}
        bothInvisible=false
        singleTrialData["Block"] = block
        if(side == "left"){
            greenBar+=lastGreenBar
            redBar+=lastRedBar
            lastGreenBar=0
            lastRedBar=0
            keyView=false
            let newDist=sample_normal_to_twenty()
            singleTrialData["newExploit"] = newDist
            singleTrialData["choice"] = "exploit"
            singleTrialData["exploreSeen"]=undefined
            exploitSelect=true
            await timer(500)
            exploitSelect=false
            clearBoard=true
            singleTrialData["exploitBoardClear"]=Date.now()
            await timer(1000)
            exploitMu=newDist
            lastGreenBar=newDist
            lastRedBar=20-newDist
            clearBoard=false
            keyView=true
            singleTrialData["newExploitBoard"]=Date.now()
            trialStartTime = Date.now()
            currentUnderstanding=newDist
            trial+=1
            console.log("done")
        }
        if(side=="right"){
            viewExplore=true
            let newDist=random_int(20)
            singleTrialData["choice"] = "explore"
            singleTrialData["exploreSeen"]=newDist
            greenBar+=lastGreenBar
            redBar+=lastRedBar
            lastGreenBar = 0
            lastRedBar = 0
            if (newDist > exploitMu){
                singleTrialData["newExploit"] = newDist
                console.log("greater than")
                keyView=false
                exploreMu=newDist
                exploreSelect=true
                singleTrialData["newExploreVisible"] = Date.now()
                await timer(500)
                exploreSelect=false
                singleTrialData["newExploreDeslected"] = Date.now()
                await timer(500)
                exploitMu=newDist
                viewExplore=false
                replaceExploit.truth=true
                counter+=1
                singleTrialData["newExploreMove"] = Date.now()
                await timer(500)
                lastGreenBar=newDist
                lastRedBar=20-newDist
                keyView = true
                singleTrialData["exploreFinishedMoving"] = Date.now()
                trialStartTime=Date.now()
                currentUnderstanding=newDist
                trial+=1
            }
        else{
            console.log("less than")
            keyView=false
            singleTrialData["newExploit"] = null
            exploreMu=newDist
            exploreSelect=true
            singleTrialData["newExploreVisible"] = Date.now()
            await timer(500)
            exploreSelect=false
            singleTrialData["newExploreDeselected"] = Date.now()
            await timer(500)
            singleTrialData["newExploreMove"] = Date.now()
            viewExplore=false
            replaceExploit.truth=false
            counter+=1
            await timer(500)
            lastGreenBar=newDist
            lastRedBar=20-newDist
            keyView = true
            singleTrialData["exploreFinishedMoving"] = Date.now()
            trialStartTime=Date.now()  
            currentUnderstanding=newDist
            trial+=1
            }
        }
        bothInvisible=false
        export_data(singleTrialData)
        if (trial === numTrials+1){
            keyView = false
            bothInvisible=true
            await timer(300)
            console.log(greenBar)
            console.log(lastGreenBar)
            toNext(gameString,greenBar+lastGreenBar)
        }
        trialHandle = false
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
    function export_data(data){
        let iterate_keys=[
            "trial",
            "previousExploit",
            "keyPressTime",
            "trialStartTime",
            "choice",
            "newExploit",
            "exploreSeen",
            "exploitBoardClear",
            "newExploitBoard",
            "newExploreVisible",
            "newExploreDeselected",
            "newExploreMove",
            "exploreFinishedMoving",
            "Block"
        ];
        let trialString=""
        for (const key of iterate_keys){
            trialString+=`${data[key]},`
        }
        gameString+=trialString.substring(0,trialString.length -1) +"\n"
        if (trial%5===0){
            sendData()
        }
    }
    async function sendData(){
        console.log("Successfully sent to server: "+ String(await server.writeFile("teacher", `TeacherCSV_${id}.csv`, gameString)))
        //console.log(await Send_Data_To_Exius([{endpoint:"TeacherCSV",fname:`Subject_${id}.csv`,data:gameString}],"Teacher_Task",writeKey))
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
    -webkit-tap-highlight-color: transparent;
    border: solid black min(.4vh,.4vw);
    cursor:pointer;
}
.greyBox:focus {
    outline: none !important;
}
.classUnderstanding {
    position: absolute; 
    top:5vh; 
    left:calc(50vw - min(25vw, 25vh)); 
    width:min(50vw, 50vh); 
    height:min(5vw, 5vh); 
    text-align:center; 
    font-size: min(2vw, 2vh);
    }
.points {
    position: absolute;
    top:0vh; 
    left:calc(50vw + min(30vw, 30vh)); 
    width: min(20vw, 20vh); 
    height:min(5vw, 5vh); 
    text-align:center; 
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid black min(.4vh,.4vw);
    font-size: min(2vw, 2vh);
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
.progressBar {
    width:min(61vh,61vw);
    height:min(5vh,5vw);
    background-color:white;
    position:absolute;
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid min(.4vh,.4vw) black
}
.progressLeft {
    top:min(.5vh,.5vw);
    height:min(4vh,4vw);
    background-color: green;
    -webkit-animation: flashGreen .5s 2;  /* Safari 4+ */
    -moz-animation: flashGreen .5s 2;  /* Fx 5+ */
    -o-animation: flashGreen .5s 2;  /* Opera 12+ */
    animation: flashGreen .5s 2;  /* IE 10+, Fx 29+ */
}
.progressRight {
    top:min(.5vh,.5vw);
    height:min(4vh,4vw);
    transform:translate(-100%);
    background-color: red;
    -webkit-animation: flashRed .5s 2;  /* Safari 4+ */
    -moz-animation: flashRed .5s 2;  /* Fx 5+ */
    -o-animation: flashRed .5s 2;  /* Opera 12+ */
    animation: flashRed .5s 2;  /* IE 10+, Fx 29+ */
}

.progressGreen {
    top:min(.5vh,.5vw);
    height:min(4vh,4vw);
    background-color: green;
}
.progressRed {
    transform:translate(-100%);
    top:min(.5vh,.5vw);
    height:min(4vh,4vw);
    background-color: red;
}
@keyframes flashGreen {
    0%, 49%{
        background-color: green
    }
    50%, 100%{
        background-color:gold
    }
}
@keyframes flashRed {
    0%, 49%{
        background-color: red
    }
    50%, 100%{
        background-color:gold
    }
}
</style>
{#key trial}
    <h1 class ="points">Day {trial} of {numTrials}</h1>
    <h1 class ="points" style="left:calc(50vw - min(50vw, 50vh));">Month {block} of {totalBlocks}</h1>
{/key}
<h1 class="classUnderstanding">Total Student Understanding</h1>
<div style = "left:calc(50vw - min(30vh,30vw)); top:min(10vh,10vw); position:absolute">
    <div class="progressBar" style="left:max(-.5vw,-.5vh)"></div>
    {#key greenBar}
        <div class = progressGreen style="width:calc((min(60vh,60vw) / {numTrials*20}) * {greenBar}); position:absolute"></div>
        {#key lastGreenBar}
            <div class = progressLeft  style="width:calc((min(60vh,60vw) / {numTrials*20}) * {lastGreenBar}); left: calc((min(60vh,60vw) / {numTrials*20}) * {greenBar} - 1px); position:absolute"></div>
        {/key}
    {/key}
    {#key redBar}
        <div class = progressRed style="width:calc((min(60vh,60vw) / {numTrials*20}) * {redBar}); left:min(60vh,60vw); position:absolute"></div>
        {#key lastRedBar}
            <div class = progressRight style="width:calc((min(60vh,60vw) / {numTrials*20}) * {lastRedBar}); left: calc(min(60vh,60vw) - ((min(60vh,60vw) / {numTrials*20}) * {redBar}) + 1px); position:absolute"></div>
        {/key}
    {/key}
</div>
{#key counter}
    {#each range as i}
        {#if counter<numTrials+1}
            {#if i==0}
                <div style=" position: absolute; left:calc(50vw - min(45vw, 45vh)); top:min(30vh,30vw);">
                    <h1 class="teachingMoves">Current Teaching Move</h1>
                    <div class = "blueLight" style="opacity: {(!exploitSelect)?"0":"1"};"></div>
                    <button class="greyBox" id={`box1: ${counter}`} in:migrateLeftExploit={{replaceExploit:replaceExploit}} out:migrateOut={{ replaceExploit: replaceExploit}} on:click = {()=>{handleButton("left")}}>
                        <div style="top:0px; position: absolute; left:-.1vw">
                            {#if !clearBoard}
                                <RedGreen numberGreen={exploitMu}/>
                            {:else}
                                <RedGreen numberGreen={0} clearBoard={true}/>
                            {/if}
                        </div>
                    </button>
                </div>
            {:else}
                <div style="position: absolute; left:calc(50vw + min(5vw, 5vh)); top:min(30vh,30vw)">
                <div class="blueLight" style="opacity: {(!exploreSelect)?"0":"1"};"></div>
                <h1 class="teachingMoves">New Teaching Move</h1>
                <button class="greyBox" id={`box2: ${counter}`} in:migrateLeftExplore={{replaceExploit:replaceExploit}} out:InvisibleOrDown={{replaceExploit:replaceExploit}} on:click={()=>{handleButton("right")}}>
                    <div style=" position: absolute; top:0px; left:-.1vw">
                        {#if viewExplore}
                            <RedGreen numberGreen={exploreMu}/>
                        {:else}
                            <div style="width: min(40vh,40vw); height:min(40vh,40vw); text-align: center; font-size: min(20vh,20vw); top: min(5vh,5vw); position:absolute">?</div>
                        {/if}
                    </div>
                </button>     
                </div>
            {/if}
        {/if}
    {/each}
{/key}
