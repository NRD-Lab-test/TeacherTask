<svelte:window on:keydown={handleKeydown}/>

<script>    
    import RedGreen from "./RedGreen.svelte"
    export let counter;
    export let trialparams;
    let choice="Exploit"
    let sequentialChoice=0
    
    function handleKeydown(event){
      if(event.key == "arrowLeft"){
          choice = "Exploit"
      }
      if(event.key=="arrowRight"){
        choice = "Explore"
      }
      trial+=1
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
    async function timer(time){
        return await new Promise(r => setTimeout(r, time));
    }
</script>
{#if choice=="Exploit"}
    <RedGreen/>
{:else}
    <div>?</div>
{/if}

