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

/****/
const db = [
    {agency: 'a1', id: 12345, created: "2020-01-05", stage: 'Leads', status: 'open', pd:{rate:"", newRate:""}},
    {agency: 'a1', id: 22345, created: "2020-01-05", stage: 'Presenting', status: 'open', pd:{rate:"1200", newRate:""}},
    {agency: 'a1', id: 32345, created: "2020-01-05", stage: 'Closed', status: 'won', pd:{rate:"1000", newRate:"950"}},
    {agency: 'a1', id: 42345, created: "2020-01-05", stage: 'Closed', status: 'won', pd:{rate:"1500", newRate:"1300"}},
    {agency: 'a1', id: 52345, created: "2020-01-05", stage: 'Verified', status: 'open', pd:{rate:"500", newRate:""}},
    {agency: 'a1', id: 62345, created: "2020-01-05", stage: 'Quoting', status: 'open', pd:{rate:"900", newRate:""}},
    {agency: 'a2', id: 12341, created: "2020-01-05", stage: 'Leads', status: 'open', pd:{rate:"1200", newRate:""}},
    {agency: 'a2', id: 12342, created: "2020-01-05", stage: 'Presenting', status: 'open', pd:{rate:"500", newRate:"400"}},
    {agency: 'a2', id: 12343, created: "2020-01-05", stage: 'Presenting', status: 'open', pd:{rate:"700", newRate:"500"}},
    {agency: 'a2', id: 12344, created: "2020-02-05", stage: 'Closed', status: 'won', pd:{rate:"1000", newRate:"800"}},
    {agency: 'a2', id: 12345, created: "2020-02-05", stage: 'Closed', status: 'archive', pd:{rate:"1000", newRate:"800"}},
    {agency: 'a2', id: 12346, created: "2020-02-05", stage: 'Closed', status: 'archive', pd:{rate:"1000", newRate:"800"}},
]

function yearMonth(created) {
    try {
        let dt = '0' + created.toLocaleDateString()
        let dtArray = dt.split('/')
        return dtArray[2] + dtArray[0].slice(-2)
    } catch (error) {
        console.error(error.message)
    }
}

function leadAmount(pd){
    return pd.newRate ? parseFloat(pd.newRate) : pd.rate ? parseFloat(pd.rate) : 0
}

function createHeader(leads){
    try {
        return leads.reduce((obj, item) => {
            //if new agency add a key and an object
            if(!obj[item.agency]){
                obj[item.agency] = {}
            }
            //if stage is missing add and seed
            if(!obj[item.agency][item.stage]){
                obj[item.agency][item.stage] = {
                    count: 1,
                    amount: leadAmount(item.pd)
                }
            } else {
                //existing stage summaryize
                //if the stage is closed we only deal with status === 'won'
                if(item.stage !== 'Closed' || (item.stage === 'Closed' && item.status === 'won')){
                    obj[item.agency][item.stage].count ++
                    obj[item.agency][item.stage].amount += leadAmount(item.pd)
                }
            }
            return obj
        },{})
    } catch (error) {
        console.error(error.message)
    }

}


;(() => {
    console.log(createHeader(db))
    //console.log(yearMonth(new Date("2020-01-05")))
})()
