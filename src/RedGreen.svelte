<script>
    export let numberGreen=0
    export let clearBoard=false
    if (!numberRed){
        numberRed=20-numberGreen
    }
    $: numberRed=(!clearBoard)?(20-numberGreen):0
    $: rangeGreen=[...Array(numberGreen).keys()]
    $: rangeRed=[...Array(numberRed).keys()]
    let stackSize=5
    let ballSize=50
   
</script>
<style>
.redDot{
    border-radius: 50%;
    background-color: red;
    width:min(4vh,4vw);
    height:min(4vh,4vw);
    position: absolute;
}
.greenDot{
    border-radius: 50%;
    background-color: green;
    width:min(4vh,4vw);
    height:min(4vh,4vw);
    position: absolute;
}
.dotContainer{
    width: min(38vw,38vh); 
    position: absolute; 
}
.ballContainer{
    top:min(8vh,8vw);
    width:min(18vh,18vw);
    height:min(25vh,25vw);
    left:max(-1vh,-1vw);
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    border: solid black min(.2vh,.2vw);
    position:absolute;
}
</style>
    <div>
    <div class = "dotContainer" style="left:min(2vw,2vh);">
        <h style="color: black; position:absolute; width: min(20vh,20vw); left: max(-2vw,-2vh); font-size: min(2vh,2vw); text-align:center; top:min(2vh,2vw)">Green Lights</h>
        <div class = "ballContainer"></div>
        {#each rangeGreen as i}
            <div class= "greenDot" style="left:calc({2*Math.floor(i/stackSize)} * min(2vh,2vw));); top: calc({2*(stackSize-i%stackSize)} * min(2vh,2vw) + min(7vh,7vw)); position:absolute;"></div>
        {/each}
        </div>
    </div>
    <div>
    <div class="dotContainer" style="left:min(21.5vw,21.5vh)">
        <h style="color: black; position:absolute; width: min(20vh,20vw); left: max(-2vw,-2vh); font-size: min(2vh,2vw); text-align:center; top:min(2vh,2vw)">Red Lights</h>
        <div class="ballContainer"></div>
        {#each rangeRed as j}
            <div class= "redDot" style="left:calc({2*Math.floor(j/stackSize)} * min(2vh,2vw)); top: calc({2*(stackSize-j%stackSize)} * min(2vh,2vw) + min(7vh,7vw)); position:absolute;"></div>
        {/each}
    </div>
</div>
