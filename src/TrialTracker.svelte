<svelte:window on:keydown={handleKeydown}/>

<script>
    export let counter=0
    
    function handleKeydown(event){
      if(event.key == "arrowLeft"){
          const choice = "Exploit"
          
      }
      if(event.key=="arrowRight"){
        const choice = "Explore"
      }
    }
</script>