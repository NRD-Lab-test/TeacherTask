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
    top:calc(80vh); 
    width:min(20vh,20vw); 
    height: min(5vh,5vw); 
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
        <button class="buttonCover" style="left:calc(50vw - min(36vh,36vw))" on:click={previousInstruction(backSkip)}>Back</button>
        <button class="buttonCover" style = "left:calc(50vw + min(16vh,16vw))" on:click={nextInstruction(forwardSkip)}>Next</button>
        {#if replayAnimation}
            <button class="buttonCover" style = "left:calc(50vw - min(10vh,10vw))" on:click={replayAnimation()}>Replay Animation</button>
        {/if}
    {:else if nextInstruction}
        <button class = "buttonCover" style = "left:calc(50vw - min(10vh,10vw))" on:click={nextInstruction(forwardSkip)}>Next</button>
    {:else}
        <button class = "buttonCover" style = "left:calc(50vw - min(10vh,10vw))" on:click={previousInstruction(backSkip)}>Back</button>
    {/if}
{/if}