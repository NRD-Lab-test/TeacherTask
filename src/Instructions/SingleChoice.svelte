<script>
    import RedGreen from "../RedGreen.svelte"
    export let passedText = ""
    export let exploitMu = 10
    export let clearBoard = false
    export let exploitSelect = true
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
    border: solid black min(.2vh,.2vw);
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
.descriptionText{
        text-align:center;
        width:min(90vw,150vh);
        font-size:min(3vh,3vw);
        left:max(5vw,calc((100vw - 150vh)/2));
        position:absolute;
    }
</style>
<h1 class="descriptionText">{passedText}</h1>
<div style=" position: absolute; left:calc(50vw - min(20vw, 20vh)); top:min(30vh,30vw);">
    <h1 class="teachingMoves">Current Teaching Move</h1>
    <div class = "blueLight" style="opacity: {(!exploitSelect)?"0":"1"};"></div>
    <div class="greyBox">
        <div style="top:0px; position: absolute">
            {#if !clearBoard}
                <RedGreen numberGreen={exploitMu}/>
            {:else}
                <RedGreen numberGreen={0} clearBoard={true}/>
            {/if}
        </div>
    </div>
</div>