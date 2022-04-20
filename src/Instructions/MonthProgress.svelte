<script>
    export let greenScore = 10
    export let numTrials= 30
    export let greenScoreLast=10
    const redScore = numTrials*20 - greenScore
    const redScoreLast = numTrials*20 - greenScoreLast
    let transitionOffBlank=false
    async function timer(time){
        return await new Promise(r=>setTimeout(r,time))
    }
    async function blankToOn(){
        await timer(500)
        transitionOffBlank=true
    }
    blankToOn()
</script>
<style>
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
.classUnderstanding {
    position: absolute; 
    top:min(20vh,20vw); 
    left:calc(50vw - min(25vw, 25vh)); 
    width:min(50vw, 50vh); 
    height:min(5vw, 5vh); 
    text-align:center; 
    font-size: min(2vw, 2vh);
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
.description {
    position: absolute; 
    top:min(48vh,48vw); 
    left:max(5vw,calc((100vw - 150vh)/2));
    width:min(90vw,150vh);
    height:min(30vw, 30vh); 
    text-align:center; 
    font-size: min(1.5vw , 1.5vh);
    }
.performanceBox {
    position:absolute;
    top:min(60vh,60vw); 
    left:max(5vw,calc((100vw - 150vh)/2));
    width:min(90vw,150vh);
    font-size: min(1.5vw , 1.5vh);
    text-align:center; 
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid min(.4vh,.4vw) black
}

</style>
    <h1 class="classUnderstanding">Total Student Understanding This Month</h1>
    <div style = "left:calc(50vw - min(30vh,30vw)); top:min(25vh,25vw); position:absolute">
        <div class="progressBar" style="left:max(-.5vw,-.5vh)"></div>
        <div class = progressGreen style="width:calc((min(60vh,60vw) / {numTrials*20}) * {greenScore}); position:absolute"></div>
        <div class = progressRed style="width:calc((min(60vh,60vw) / {numTrials*20}) * {redScore}); left:min(60vh,60vw); position:absolute"></div>
    </div>
    <h1 class="classUnderstanding" style="top:min(33vh,33vw)">Total Student Understanding Last Month</h1>
    <div style = "left:calc(50vw - min(30vh,30vw)); top:min(38vh,38vw); position:absolute">
        <div class="progressBar" style="left:max(-.5vw,-.5vh)"></div>
        <div class = progressGreen style="width:calc((min(60vh,60vw) / {numTrials*20}) * {greenScoreLast}); position:absolute"></div>
        <div class = progressRed style="width:calc((min(60vh,60vw) / {numTrials*20}) * {redScoreLast}); left:min(60vh,60vw); position:absolute"></div>
    </div>
<div class="description">
    <h1> Your classroom's understanding at the end of this month was {Math.round(100*greenScore/(numTrials*20))}%, and
    your classroom's understanding last month was {Math.round(100*greenScoreLast/(numTrials*20))}%
    </h1>
</div> 
<div >
    <div class ="performanceBox">
    {#if greenScore>greenScoreLast}
        <h1>Great Job! You improved upon your classroom's understanding from the last month! Let's try and do even better in the next month!</h1>
    {/if}
    {#if greenScore<greenScoreLast}
        <h1>Oh no! It looks like your classroom's understanding dropped from the last month, let's try and beat this score next time!</h1>
    {/if}
    {#if greenScore == greenScoreLast}
            <h1 >Looks like you tied your last score! Let's try and beat that score in the next month!</h1>
    {/if}
</div>
</div>
