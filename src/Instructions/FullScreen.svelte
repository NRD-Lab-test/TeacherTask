<script>
export let nextInstruction
async function timer(time){
        return await new Promise(r => setTimeout(r, time));
    }
async function requestFullScreen(){
    var elem=document.documentElement
    var requestMethod = elem.requestFullScreen || elem.webkitRequestFullScreen || elem.mozRequestFullScreen || elem.msRequestFullScreen;
    if (requestMethod) {
        requestMethod.call(elem)
    }
    await timer(100)
    nextInstruction(1)
    }
</script>
<style>
    .buttonCover{
    position:absolute; 
    top:60vh;
    left:calc(50vw - min(20vw,20vh));
    width:min(40vh,40vw); 
    height: min(20vh,20vw); 
    text-align: center; 
    border: solid black min(.4vw,.4vh);
    font-size: min(5vh,5vw);
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    text-align: center;
    color: black
    }
    .buttonCover:hover{
    background-color:rgb(220, 216, 216);
    cursor: pointer;
    }
    .bigText{
    font-size:min(10vh,10vw);
    text-align:center;
    position:absolute;
    width:80vw;
    left:10vw;
    }
</style>
<h1 class="bigText" style="text-align: center">This Experiment is Best Viewed In Fullscreen</h1>
<button class="buttonCover" on:click={requestFullScreen}>Go Fullscreen</button>