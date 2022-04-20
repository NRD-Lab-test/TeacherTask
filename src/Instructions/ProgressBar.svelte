<script>
    export let lastGreenBar=0
    export let lastRedBar=0
    export let greenBar = 0
    export let redBar=0
    export let numTrials=30
</script>
<style>
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
    -webkit-animation: flashGreen .5s 3;  /* Safari 4+ */
    -moz-animation: flashGreen .5s 3;  /* Fx 5+ */
    -o-animation: flashGreen .5s 3;  /* Opera 12+ */
    animation: flashGreen .5s 3;  /* IE 10+, Fx 29+ */
}
.progressRight {
    top:min(.5vh,.5vw);
    height:min(4vh,4vw);
    transform:translate(-100%);
    background-color: red;
    -webkit-animation: flashRed .5s 3;  /* Safari 4+ */
    -moz-animation: flashRed .5s 3;  /* Fx 5+ */
    -o-animation: flashRed .5s 3;  /* Opera 12+ */
    animation: flashRed .5s 3;  /* IE 10+, Fx 29+ */
}
.classUnderstanding {
    position: absolute; 
    top:min(40vh,40vw); 
    left:calc(50vw - min(25vw, 25vh)); 
    width:min(50vw, 50vh); 
    height:min(5vw, 5vh); 
    text-align:center; 
    font-size: min(2vw, 2vh);
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
<h1 class="classUnderstanding">Total Student Understanding</h1>
<div style = "left:calc(50vw - min(30vh,30vw)); top:min(50vh,50vw); position:absolute">
    <div class="progressBar" style="left:max(-.5vw,-.5vh)"></div>
    {#key greenBar}
        <div class = progressGreen style="width:calc((min(60vh,60vw) / {numTrials*20}) * {greenBar}); position:absolute"></div>
        {#key lastGreenBar}
            <div class = progressLeft  style="width:calc((min(60vh,60vw) / {numTrials*20}) * {lastGreenBar}); left: calc((min(60vh,60vw) / {numTrials*20}) * {greenBar}); position:absolute"></div>
        {/key}
    {/key}
    {#key redBar}
        <div class = progressRed style="width:calc((min(60vh,60vw) / {numTrials*20}) * {redBar}); left:min(60vh,60vw); position:absolute"></div>
        {#key lastRedBar}
            <div class = progressRight style="width:calc((min(60vh,60vw) / {numTrials*20}) * {lastRedBar}); left: calc(min(60vh,60vw) - ((min(60vh,60vw) / {numTrials*20}) * {redBar}) + 1px); position:absolute"></div>
        {/key}
    {/key}
</div>