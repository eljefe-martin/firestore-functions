const admin = require('firebase-admin')
const fs = require('fs')
const app = admin.initializeApp({
    credential: admin.credential.applicationDefault()
})
const db = app.firestore()

async function onSummarizeLeads() {
    try {
        const result = await summarizeLeads() 
        //clean up add
        return result       
    } catch (error) {
        console.error(error.messsage)
    }
}

async function getAgents(){
    try {
        let snapshot = await db.collectionGroup('users').get()
        let agents =[]
        snapshot.forEach(agent => {
            agents.push(agent.data())
        })
        return agents 
    } catch (error) {
        
    }
}

async function summarizeLeads(){
        try {
            let result =[]
            let agentLookup = await getAgents()
            let snapshot = await db.collectionGroup('leads').get()
            snapshot.forEach(doc => {
                let lead = doc.data() 
                let agentId = lead.agent.uid 
                let agentName = agentLookup.filter(user => user.uid === agentId)[0].name
                let amount = lead.autoPolicyDetails && lead.autoPolicyDetails.newRate 
                    ? lead.autoPolicyDetails.newRate 
                    : lead.autoPolicyDetails && lead.autoPolicyDetails.rate 
                    ? lead.autoPolicyDetails.rate : 0
                let summaryLead = {
                    yearMonth: yearMonth(lead.created),
                    agent: {name: agentName, ...lead.agent},
                    agencyId: lead.agency,
                    client: `${lead.firstName} ${lead.lastName}`,
                    address: `${lead.address}, ${lead.city}, ${lead.state}`,
                    hasComments: lead.comments && lead.comments.length > 0 ? true : false,
                    amount,
                    stage: lead.stage, status: lead.status
                }
                result.push(summaryLead)
            })
            //move them leads into agency specific arrays
            let agencySummary = result.reduce((obj, rec) => {
                if(Object.keys(obj).indexOf(rec.agencyId) > -1){
                    //key exists push to array
                    obj[rec.agencyId].push(rec)
                    return obj 
                } else {
                    //add new key
                    obj[rec.agencyId] = [rec]
                    return obj
                }
            },{})
            return agencySummary
        } catch (error) {
            console.error(error.message)
        }
    }

function yearMonth(created){
    let dt = '0' + new Date(created._seconds * 1000).toLocaleDateString()
    let dtArray = dt.split('/')
    return dtArray[2] + dtArray[0].slice(-2)
}

;(async ()=>{
    try {
        let summary = await onSummarizeLeads()
        //update firestore
        for ( agency in summary){
                const objRef = db.collection('agencies').doc(agency)
                await objRef.update({leadSummary: summary[agency]})
        }
    } catch (error) {
        console.error(error.message)
    }    
    //fs.writeFileSync('./agencySummary.json',JSON.stringify(summary),'utf8')
})()    