<svelte:window on:keydown={handleKeydown}/>
<script>
    export let breakTruth={truth:false}
    export let nextInstruction=null
    export let nextArrow
    async function timer(time){
        return await new Promise(r => setTimeout(r, time));
    }
    async function handleKeydown(event){
        if (!breakTruth.truth){
                if (event.key === nextArrow){
                    nextInstruction()
                }
        }
    }
</script>
