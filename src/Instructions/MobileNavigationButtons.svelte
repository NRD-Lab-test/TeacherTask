<script>
    export let breakTruth={truth:false}
    export let nextInstruction=null
    export let previousInstruction=null
    export let replayAnimation=null
    export let backSkip =1
    export let forwardSkip =1
    export let display = true
</script>
<style>
    .buttonCover{
    position:absolute; 
    top:0; 
    width:5vw; 
    height: 100%; 
    text-align: center; 
    border: solid black min(.4vw,.4vh);
    font-size: min(2vh,2vw);
    box-sizing: border-box;
    -moz-box-sizing: border-box;
    -webkit-box-sizing: border-box;
    text-align: center;
    }
    .buttonCover:hover{
    background-color:rgb(220, 216, 216);
    cursor: pointer;
    }
</style>
{#if !breakTruth.truth && display}
    {#if nextInstruction && previousInstruction}
        <button class="buttonCover" style="left:0vw" on:click={previousInstruction(backSkip)}>Back</button>
        <button class="buttonCover" style = "left:95vw" on:click={nextInstruction(forwardSkip)}>Next</button>
        {#if replayAnimation}
            <button class="buttonCover" style = "left:calc(50vw - 10vw);top:80vh;height:5vh;width:20vw" on:click={replayAnimation()}>Replay Animation</button>
        {/if}
    {:else if nextInstruction}
        <button class = "buttonCover" style = "left:95vw" on:click={nextInstruction(forwardSkip)}>Next</button>
    {:else}
        <button class = "buttonCover" style = "left:0vw" on:click={previousInstruction(backSkip)}>Back</button>
    {/if}
{/if}