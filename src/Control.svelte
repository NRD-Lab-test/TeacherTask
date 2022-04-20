<script>
    import Game from "./Game.svelte"
    import MobileGame from "./MobileGame.svelte"
    import Instructions from "./Instructions/Instructions.svelte"
    import MobileInstructions from "./Instructions/MobileInstructions.svelte";
    import Redirect from './Redirect.svelte'
    import Password from "./Password.svelte"
    import BlockEnd from "./BlockEnd.svelte"
    import DetectMobile from "./DetectMobile.svelte"
    let instructionsDone=false
    let gameEnd=false
    let passedKey=false
    let writeKey=undefined
    let id = undefined
    let mobileDetectDone = false
    let gameData=`"trial","previousExploit",
            "keyPressTime",
            "trialStartTime",
            "choice",
            "newExploit",
            "exploreSeen",
            "exploitBoardClear",
            "newExploitBoard",
            "newExploreVisible",
            "newExploreDeselected",
            "newExploreMove",
            "exploreFinishedMoving",
            "Block"\n`
    let years = 6
    let yearEnd=false
    let greenArray = []
    let yearCounter = 1
    let mobile = true
    let server
    function toGame(){
        instructionsDone = true
    }
    function toNext(data,greens){
        if (yearCounter < years){
            yearEnd=true
            gameData=data
            greenArray.push(greens)
            yearCounter+=1
        }
       else{
           gameEnd=true
       }
    }
    function getData(data){
        gameData+=data
        console.log(data)
    }
    function getServer(serverObj,passedId){
        //console.log(serverObj)
        console.log("back to page")
        server = serverObj
        passedKey=true
        id = passedId
        console.log(server)
    }
    function nextYear(){
        yearEnd=false
    }
    function getMobile(mobileTruth){
        mobile = mobileTruth
        mobileDetectDone = true
    }
</script>
{#if !mobileDetectDone}
    <DetectMobile getMobile={getMobile}/>
{/if}
{#if !passedKey && mobileDetectDone}
    <Password getServer={getServer}/>
{/if}
{#if passedKey && instructionsDone===false}
    {#if mobile}
        <MobileInstructions toGame={toGame} getData={getData} server={server} id={id}/>
    {:else}
        <Instructions toGame={toGame} getData={getData} server={server} id={id}/>
    {/if}
{/if}
{#if (instructionsDone && !gameEnd)}
    {#if yearEnd}
        <BlockEnd greenScore={greenArray[greenArray.length-1]} greenScoreLast={(greenArray.length>1)?greenArray[greenArray.length-2]:null} firstBlock={(greenArray.length>1)?false:true} nextYear={nextYear} lastBlock={greenArray.length === years}/>
    {:else}
        {#if mobile}
            <MobileGame toNext={toNext} gameString={gameData} id={id} totalBlocks={years} block={yearCounter} server={server}/>
        {:else}
            <Game toNext={toNext} gameString={gameData} id={id} totalBlocks={years} block={yearCounter} server={server}/>
        {/if}
    {/if}
    <!-- <Game toDebrief={toDebrief} gameString={gameData} writeKey={writeKey} id={id} totalBlocks={6} block={1}/>
    -->
{/if}
{#if gameEnd}
    <Redirect/>
{/if}

