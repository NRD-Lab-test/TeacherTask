<svelte:window on:resize={isLandscape}/>
<script>
    export let getMobile
    let message = ""
    let mobileDevice = isMobile()
    let landscape = false
    landscape = isLandscape()
    function isMobile() {
        if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
            return true
           }
        return /Macintosh/.test(navigator.userAgent) && 'ontouchend' in document
        }
    function isLandscape(e){
        console.log("fired")
        if (window.innerWidth > window.innerHeight){
            landscape= true
        }else{
            landscape = false
        }
        if (mobileDevice){
            if (!landscape){
                message = "We have detected that you are on a mobile device. Please orient your screen to landscape to continue."
            }else{
                getMobile(true)
            }
        }else{
            if (!landscape){
                message = "We have detected that you are on a desktop device. Please orient your screen to landscape to continue."
            }else{
                getMobile(false)
            }
        }
    }

</script>
<h1>{message}</h1>
