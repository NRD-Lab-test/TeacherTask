<script>
    export let greenScore = 10
    export let numTrials= 30
    export let firstBlock = false
    export let lastBlock = false
    export let greenScoreLast=10
    export let nextYear
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
    top:min(5vh,5vw); 
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
    top:min(30vh,30vw); 
    left:calc(50vw - 48vw); 
    width:min(96vw); 
    height:min(30vw, 30vh); 
    text-align:center; 
    font-size: min(2vw , 2vh);
    }
.performanceBox {
    position:absolute;
    top:min(50vh,50vw); 
    left:calc(50vw - 48vw); 
    width:min(96vw); 
    font-size: min(2vw , 2vh);
    text-align:center; 
}
.fancyButton {
    position:absolute;
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid min(.4vh,.4vw) black;
    width: min(40vh,40vw);
    top:min(80vh,80vw);
    left: calc(50vw - min(20vh,20vw));
    text-align: center;
    font-size: min(1.5vh,1.5vw);
    color: black;
}
.fancyButton:hover{
    box-shadow: 0 0 min(2vh,2vw) blue;
    cursor: pointer;
}
</style>
{#if transitionOffBlank}
    <h1 class="classUnderstanding">Total Student Understanding This Month</h1>
    <div style = "left:calc(50vw - min(30vh,30vw)); top:min(10vh,10vw); position:absolute">
        <div class="progressBar" style="left:max(-.5vw,-.5vh)"></div>
        <div class = progressGreen style="width:calc((min(60vh,60vw) / {numTrials*20}) * {greenScore}); position:absolute"></div>
        <div class = progressRed style="width:calc((min(60vh,60vw) / {numTrials*20}) * {redScore}); left:min(60vh,60vw); position:absolute"></div>
    </div>
    {#if !firstBlock}
        <h1 class="classUnderstanding" style="top:min(15vh,15vw)">Total Student Understanding Last Month</h1>
        <div style = "left:calc(50vw - min(30vh,30vw)); top:min(20vh,20vw); position:absolute">
            <div class="progressBar" style="left:max(-.5vw,-.5vh)"></div>
            <div class = progressGreen style="width:calc((min(60vh,60vw) / {numTrials*20}) * {greenScoreLast}); position:absolute"></div>
            <div class = progressRed style="width:calc((min(60vh,60vw) / {numTrials*20}) * {redScoreLast}); left:min(60vh,60vw); position:absolute"></div>
        </div>
    {/if}
    {#if firstBlock}
        <div class="description">
            <h1> Your classroom's understanding at the end of this semester was {Math.round(100*greenScore/(numTrials*20))}%</h1>
        </div>
        <div class ="clearfix performanceBox">
            <h1 >Good job on your first month! Let's try and do even better next month!</h1>
        </div>
    {:else if lastBlock}
        <div class="description">
            <h1> Your classroom's understanding at the end of this month was {Math.round(100*greenScore/(numTrials*20))}%, and
            your classroom's understanding last month was {Math.round(100*greenScoreLast/(numTrials*20))}%
            </h1>
        </div> 
        <div >
            <div class ="clearfix performanceBox">
            {#if greenScore>greenScoreLast}
                <h1>Great Job! You improved upon your classroom's understanding from the last month! Click the button below to finish the experiment!</h1>
            {/if}
            {#if greenScore<greenScoreLast}
                <h1>Oh no! It looks like your classroom's understanding dropped from the last month! Click the button below to finish the experiment!</h1>
            {/if}
            {#if greenScore == greenScoreLast}
                    <h1 >Looks like you tied your last score! Click the button below to finish the experiment!</h1>
            {/if}
        </div>
        </div>
    {:else}
        <div class="description">
            <h1> Your classroom's understanding at the end of this month was {Math.round(100*greenScore/(numTrials*20))}%, and
            your classroom's understanding last month was {Math.round(100*greenScoreLast/(numTrials*20))}%
            </h1>
        </div> 
        <div >
            <div class ="clearfix performanceBox">
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
    {/if}
    <button class="fancyButton" on:click={nextYear()}>
        <h1>Start Next Month</h1>
    </button>
{/if}
