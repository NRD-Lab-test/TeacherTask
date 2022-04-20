<script>
    import {ExiusServer} from "exius/web-nocomp"
    import config from "./config"
    export let getServer
    let preflightInitiated = false
    let preflightError = false
    const URL = config.server
    let queryData = getQuery()
    let id = queryData.id
    let keyValue = queryData.key
    let archive = queryData.archive
    let errorMessage = ""
    if (archive){
        console.log("Accessing archived version")
        getServer({KeyValue:"0", writeFile:()=>{}},0)
    }
    else if (id && keyValue){
        console.log("Accessing live version")
        preflightInitiated=true
        preflightExius(
            [
                {endpoint:"teacher", fname:`TeacherCSV_${id}.csv`, data:""},
                {endpoint:"teacher", fname:`TeacherResponse_${id}.txt`, data:""}
            ]
            )
    }else{
        preflightError = true
        errorMessage = "id and key must be present in query string of url"
    }
    
    async function preflightExius(fileInfo){
        try{
            let exius = await ExiusServer.init(URL, keyValue)
            for (const file of fileInfo){
                await exius.writeFile(file.endpoint, file.fname, file.data)
            }
            getServer(exius, id)
        }catch(e){
            console.log(e)
            preflightError=true
            errorMessage = "Access denied. Make sure the key you entered has the correct permissions"
        }
    }

    function getQuery(){
        return Object.fromEntries([...new URLSearchParams(window.location.search)])
    }
    //modified
    //submitPreflight((queryData.id)?queryData.id:1234,queryData.pwd)
</script>
{#if preflightInitiated}
    <h1>Checking Credentials...</h1>
{/if}
{#if preflightError}
    <h1>Error:{errorMessage}</h1>
{/if}