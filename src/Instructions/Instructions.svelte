<script>
    import NavigationButtons from "./NavigationButtons.svelte";
    import SingleChoice from "./SingleChoice.svelte"
    import DoubleChoice from "./DoubleChoice.svelte"
    import FullScreen from "./FullScreen.svelte"
    import PracticeGame from "./PracticeGame.svelte"
    import NavigationArrows from "./NavigationArrows.svelte"
    import ProgressBar from "./ProgressBar.svelte"
    import MonthProgress from  "./MonthProgress.svelte"
    import Game from "../Game.svelte"
    export let toGame
    export let i=0
    export let breakTruth = {truth:false}
    export let getData
    export let server
    export let id
    let animationCounter=0
    let practiceData=undefined
    let warmUp=""
    function nextInstruction(n){
        (!(typeof n == "number"))?n=1:n=n
        i+=n
    }
    function previousInstruction(n){
        (!(typeof n == "number"))?n=1:n=n
        i-=n
    }
    function replayAnimation(){
        animationCounter+=1
    }
    function breakNav(value){
        breakTruth.truth=value
    }
    async function sendGameUpstream(data){
        (async ()=>{console.log("Successfully sent to server: " + String(await server.writeFile("teacher", `TeacherCSV_${id}.csv`,data)))})();
        getData(data)
        //modified
        i+=1
    }

   $: {if (i === 4){
        console.log("Sending Response...");
        (async ()=>{
            console.log("Successfully sent to server: " + String(await server.writeFile("teacher", `TeacherResponse_${id}.txt`, warmUp)))
        })()
    }}
    $: {if (i === 25){
        iterate_i()
    }
    }
    async function timer(time){
        return await new Promise(r => setTimeout(r, time));
    }
    async function iterate_i(){
        await timer(3000)
        i+=1
    }
</script>
<style>
    .descriptionText{
        text-align:center;
        font-size:min(3vh,3vw);
        left:max(5vw,calc((100vw - 180vh)/2));
        width:min(90vw,180vh);
        position:absolute;
    }
    .titleText{
        font-size:min(18vh,18vw);
        text-align:center;
        position:absolute;
        width:100vw
    }
    .textBox{
        top: min(20vh,20vw);
        left:calc(50vw - min(25vw,25vh)); 
        width:min(50vw,50vh); 
        height:min(40vw,40vh); 
        font-size: min(3vw,3vh); 
        position: absolute
    }
    .imageBox{
        position: absolute; 
        top: min(20vw,20vh); 
        left: calc(50vw - min(40vh,40vw)); 
        width: min(80vh,80vw); 
        height: min(50vw,50vh); 
        box-sizing: border-box;
        -moz-box-sizing: border-box;
        -webkit-box-sizing: border-box;
        border: solid black;    
    }
    .imageScale{
        position: absolute;
        left: calc(50vw - min(35vh,35vw)); 
        width: min(70vh,70vw);
        height: min(40vw,40vh);
        top: min(28vw,28vh); 
    }
    .imageText{
        position:absolute;
        text-align:center;
        font-size:min(3vh,3vw);
        width: min(80vh,80vw); 
        top: min(20vw,20vh); 
        left: calc(50vw - min(40vh,40vw)); 
    }
    .redGreenBall{
        position:absolute;
        text-align:center;
        font-size:min(5vh,5vw);
        left: calc(50vw - min(38vh,38vw));
        width:min(12vh,12vw);
        height:min(12vh,12vw);
        border-radius: 50%;
    }
    .understandBox{
        position:absolute;
        box-sizing: border-box;
        -moz-box-sizing: border-box;
        -webkit-box-sizing: border-box;
        border: solid black;  
        width: min(50vh,50vw);
        height: min(10vw,10vh);
        left: calc(50vw - min(23vh,23vw));
        font-size: min(2.8vh,2.8vw);
        padding:min(1.2vh,1.2vw);
    }
    .points {
        position: absolute;
        top:min(40vh,40vw); 
        left:calc(50vw + min(30vw, 30vh)); 
        width: min(20vw, 20vh); 
        height:min(5vw, 5vh); 
        text-align:center; 
        box-sizing: border-box;
        -moz-box-sizing: border-box;
        -webkit-box-sizing: border-box;
        border: solid black min(.4vh,.4vw);
        font-size: min(2vw, 2vh);
    }
</style>
{#if i===0}
    <FullScreen nextInstruction={nextInstruction}/>
{/if}
{#if i===1}
    <h1 class="titleText">The <br/>Teaching Task</h1>
    <h1 style="top:70vh;width:min(60vw,60vh);left:calc(50vw - min(20vw,20vh));position:absolute;font-size:min(3vh,3vw);"> Click Next to Start the Task</h1>
    <NavigationButtons nextInstruction={nextInstruction}/>
{/if}
{#if i ===2}
    <h1 class="descriptionText">
        For this experiment, you will play a teaching task.  Please read through these instructions carefully.
         Remember that this is an important part of our study. Please give this task adequate time and effort, and try to get the best results.  
        </h1>
        <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===3}
<h1 class="descriptionText">
    To start off, we want you to take a moment to think about and describe your current math warm up in 1 or 2 sentences.
    </h1>
    <textarea bind:value={warmUp} rows=4 wrap="soft" placeholder="Input description here..." class= "textBox"></textarea>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===4}
<h1 class="descriptionText">
    Now, we want you to imagine that your math coach or colleague has suggested a new approach for your math warm up. 
</h1>
<NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===5}
<h1 class="descriptionText">
    In this experiment  - the teaching task - we would like you to choose between two teaching approaches for your math warm up, (1) your current math warm up that seems to be working well or (2) the “new” suggested approach for your math warm up. </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===6}
    <h1 class="descriptionText">
        For the purposes of this task, we will keep the teaching approaches generic (“current” approach or “new” approach by the coach) but we want you to imagine what those approaches might be (i.e. starting with a group problem, a quick review worksheet, calendar time, or a math discussion).
    </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===7}
    <h1 class="descriptionText">
        To get feedback on how well the approach worked, your students will display a red light or green light to show their understanding.  
    </h1>
    <div class ="imageBox"></div>
    <h1 class = "imageText">How much did you understand?</h1>
    <img class="imageScale" src="https://cdn.vox-cdn.com/thumbor/8XjPCHo_W0zCH1YDoR3ST3cN51E=/0x0:6720x4480/920x613/filters:focal(2823x1703:3897x2777)/cdn.vox-cdn.com/uploads/chorus_image/image/64906829/f9c5667541.0.jpeg" alt="temp">
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===8}
    <h1 class="descriptionText">
        The response of a student holding up a red or green card after being asked might be like:
    </h1>
    <div class="imageBox"></div>
    <h1 class = "imageText">How much did you understand?</h1>
        <div class="redGreenBall" style="background-color:red;top:min(31vh,31vw)">
            <h1 style="top:50%;left50%;height:20%;width:20%;margin:0% 25%">R</h1>
        </div>
        <div class="redGreenBall" style="background-color:green; top:min(51vh,51vw)"> 
            <h1 style="top:50%;left50%;height:20%;width:20%;margin:2% 20%">G</h1>
        </div>
        <h1 class="understandBox" style="top:min(30vh,30vw)">
            I do not get it! This did not help me.
        </h1>
        <h1 class="understandBox" style="top:min(50vh,50vw)">I understand!
            I am happy with how this went.            
        </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===9}
    <SingleChoice passedText="You have a class of 20 students. Each student is represented by a circle. A teaching approach, or move, can have different outcomes day to day. On the first day you try it, you might get 12 students showing green and 8 showing red (shown below)" exploitSelect={false} exploitMu={12}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===10}
    <SingleChoice passedText="And the second day you try the same move it might not work so well - 9 students showing green and 11 showing red." exploitSelect={false} exploitMu={9}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===11}
    <SingleChoice passedText="And on the next day you might try the same move and get slightly better results - 15 students showing green and 5 showing red. As you can see, the same move can get slightly better or worse results over time but stays fairly close to what it was the day before." exploitSelect={false} exploitMu={15}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i === 12}
    <h1 class="descriptionText">When you play the task, the two teaching approaches will be represented like this.  
        Your current approach shows the outcome from the last time you used that approach.
        The outcome from your new approach is unknown until you try it.
    </h1>
    <DoubleChoice exploitMu={11}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===13}
    <h1 class="descriptionText">If you choose to continue with your current teaching approach, it will light up with a blue border and a new outcome will appear.  
    </h1>
    <NavigationButtons breakTruth={breakTruth} nextInstruction={nextInstruction} previousInstruction={previousInstruction} replayAnimation={replayAnimation}/>
    {#key animationCounter}
        <DoubleChoice breakNav={breakNav} delayExploit={true} exploitMu={11}/>
    {/key}
{/if}
{#if i ===14}
<h1 class="descriptionText">Or if you choose to switch to the new approach, it will light up and show the results like this…
</h1>
<NavigationButtons breakTruth={breakTruth} nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
<DoubleChoice breakNav={breakNav} exploreSelect={true} viewExplore={true} exploitMu={11}/>
{/if}
{#if i === 15}
    <h1 class="descriptionText">If the new approach is worse than the current approach, you earn fewer points on the trial. Then, since it is worse, this new approach is discarded.
    </h1>
    <NavigationButtons breakTruth={breakTruth} nextInstruction={nextInstruction} previousInstruction={previousInstruction} replayAnimation={replayAnimation}/>
    {#key animationCounter}
        <DoubleChoice breakNav={breakNav} delayBadExplore={true} exploitMu={11} noReplaceExplore={true}/>
    {/key}
{/if}
{#if i === 16}
    <h1 class="descriptionText">Then another new approach will appear. Now you can choose again from the current approach or another new approach.
    </h1>
    <NavigationButtons breakTruth={breakTruth} nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
    <DoubleChoice breakNav={breakNav} exploitMu={11}/>
{/if}
{#if i === 17}
    <h1 class="descriptionText">If you were to try the new approach and it is better than the current approach,  it will replace your current approach for your next choice. 
    </h1>
    <NavigationButtons breakTruth={breakTruth} nextInstruction={nextInstruction} previousInstruction={previousInstruction} replayAnimation={replayAnimation}/>
    {#key animationCounter}
        <DoubleChoice breakNav={breakNav} delayGoodExplore={true} exploitMu={11} exploreMu={16} noReplaceExplore={true}/>
    {/key}
{/if}
{#if i === 18}
    <h1 class="descriptionText">Once again, another new approach will appear... and so on...
    </h1>
    <NavigationButtons breakTruth={breakTruth} nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
    <DoubleChoice breakNav={breakNav} exploitMu={16}/>
{/if}
{#if i === 19}
    <h1 class="descriptionText">To recap, you need to choose between you current approach and a new approach.  Choosing you current approach gives you a similar result to what you got last time (slightly better or worse).  Choosing a new approach give you a totally new outcome(that can be a lot better or a lot worse).
    </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i === 20}
    <h1 class="descriptionText">Before you begin, to make sure you've got everything, we will walk you through several trials...
    </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i === 21}
    <h1 class="descriptionText">For our first trial we have a current teaching approach that seems to be working fairly well, so we may want to stick with our current approach (press the left arrow)</h1>
    <DoubleChoice breakNav={breakNav} exploitMu={12} keyDisplay={true}/>
    <NavigationArrows breakTruth={breakTruth} nextInstruction={nextInstruction} nextArrow={"ArrowLeft"}/>
{/if}
{#if i=== 22}
    <h1 class="descriptionText">We can see that when we tried our current teaching approach it got better! So, we may want to keep trying that approach (press the left arrow)</h1>
    <DoubleChoice breakNav={breakNav} keyDisplay={true} delayExploit={true} exploitMu={12} exploitMu2={13} delayTime={0}/>
    <NavigationArrows breakTruth={breakTruth} nextInstruction={nextInstruction} nextArrow={"ArrowLeft"}/>
{/if}
{#if i=== 23}
    <h1 class="descriptionText">Oh no! We seem to have gotten a bad outcome that time. Since our current choice is not performing well we may want to switch to a new approach (press the right arrow)</h1>
    <DoubleChoice breakNav={breakNav} keyDisplay={true} delayExploit={true} exploitMu={13} exploitMu2={8} delayTime={0}/>
    <NavigationArrows breakTruth={breakTruth} nextInstruction={nextInstruction} nextArrow={"ArrowRight"}/>
{/if}
{#if i=== 24}
    <h1 class="descriptionText">After trying the new approach, we got a worse outcome than our current approach. We may still think that there are better options out there though, and we decide to try another new approach (press the right arrow)</h1>
    <DoubleChoice breakNav={breakNav} keyDisplay={true} delayBadExplore={true} exploitMu={8} exploreMu={1} delayTime={0}/>
    <NavigationArrows breakTruth={breakTruth} nextInstruction={nextInstruction} nextArrow={"ArrowRight"}/>
{/if}
{#if i=== 25}
    <h1 class="descriptionText">Great! We seem to have found a much better approach when we tried another new approach. Now it is your turn to try a couple of trials by yourself. Choose either the left or right arrow to make your decision.</h1>
    <DoubleChoice breakNav={breakNav} keyDisplay={true} delayGoodExplore={true} exploitMu={8} exploreMu={15} delayTime={0}/>
{/if}
{#if i === 26}
<PracticeGame breakTruth={breakTruth} toNext={nextInstruction} trialDescriptions={[
    "Great! We seem to have found a much better approach when we tried another new approach. Now it is your turn to try a couple of trials by yourself. Choose either the left or right arrow to make your decision.",
    "Lets try another, 3 practice trials left",
    "Lets try another, 2 practice trials left",
    "Lets try another, 1 practice trials left",
    ""
]}/> 
{/if}
{#if i ===27}
    <h1 class="descriptionText"> The game will be organized into days and months, and the current day/month will be displayed at the top of your screen.
         Every time you choose either your current teaching move or a new teaching move, it will increase your day count. At the end of 30 days, a new month
        will happen. Here is the display you would see if you were currently on day 5 of the second month.</h1>
    <h1 class ="points">Day {5} of {30}</h1>
    <h1 class ="points" style="left:calc(50vw - min(50vw, 50vh));">Month {2} of {6}</h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction} backSkip={7}/>
{/if}
{#if i ===28}
    <h1 class="descriptionText">Your points will be kept track of with a progress bar at the top of your screen. The total bar length represents your total accumulated red and green lights this month. The flashing sections
        represent the red and green lights that you recieved on your last choice. </h1>
    <ProgressBar lastGreenBar={15} lastRedBar={5} greenBar = {250} redBar={210} numTrials={30}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i === 29}
    <h1 class="descriptionText">So, all together, the top of your screen will look something like:</h1>
    <h1 class ="points">Day {23} of {30}</h1>
    <h1 class ="points" style="left:calc(50vw - min(50vw, 50vh));">Month {2} of {6}</h1>
    <ProgressBar lastGreenBar={15} lastRedBar={5} greenBar = {250} redBar={210} numTrials={30}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i ===30}
<h1 class="descriptionText">At the end of each month, you will be shown a screen giving your performance that month and the month before. This gives you a chance to 
    improve upon your score between months! If you improved upon your previous, you would see something like:
</h1>
    <MonthProgress greenScore={380} greenScoreLast={300} numTrials={30}/>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i === 31}
    <h1 class="descriptionText">Now that you've seen all the parts of the game, lets have you do a couple of rounds by yourself. The classroom understanding bar will be added into these trials.
    </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction}/>
{/if}
{#if i === 32}
    <Game toNext={sendGameUpstream} gameString={`"trial","previousExploit","keyPressTime","trialStartTime","choice","newExploit","exploreSeen","exploitBoardClear","newExploitBoard","newExploreVisible","newExploreDeselected","newExploreMove","exploreFinishedMoving","Block"\n`} id={id} totalBlocks={0} block={0} numTrials={10} server={server}/>
{/if}
{#if i === 33}
    <h1 class="descriptionText">At this point you should have a firm understanding of the task. This task will go for 6 months of 30 days each. Remember to maximize your students' understanding, and good luck! To review any of the instructions click back, to continue to the task click next.
    </h1>
    <NavigationButtons nextInstruction={nextInstruction} previousInstruction={previousInstruction} backSkip={2}/>
{/if}
{#if i === 34}
    {toGame()}
{/if}
