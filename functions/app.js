const admin = require('firebase-admin')
const fs = require('fs')
const leadData = require('./leads.json')
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

async function getLeads(){
    try {
        let data = []
        console.log('...start')
        let snapshot = await db.collectionGroup('leads').get()
        console.log('..got data')
        snapshot.forEach(lead => {
            let doc = lead.data()
            delete doc.id 
            data.push({id: lead.id, ...doc})
        })
        console.log('...write data')
        fs.writeFileSync('./leads.json', JSON.stringify(data), 'utf8')
    } catch (error) {
        console.error('getLeads error', error.message)
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
/*
;(async ()=>{
    try {
        await getLeads()
        //let summary = await onSummarizeLeads()
        //update firestore
        //for ( agency in summary){
        //        const objRef = db.collection('agencies').doc(agency)
        //        await objRef.update({leadSummary: summary[agency]})
        //}
    } catch (error) {
        console.error(error.message)
    }    
    //fs.writeFileSync('./agencySummary.json',JSON.stringify(summary),'utf8')
})()    

function yearMonth(created) {
    try {
        let dt = '0' + created.toLocaleDateString()
        let dtArray = dt.split('/')
        return dtArray[2] + dtArray[0].slice(-2)
    } catch (error) {
        console.error(error.message)
    }
}
*/

function leadAmount(pd){
    return pd && pd.newRate ? parseFloat(pd.newRate) : pd && pd.rate ? parseFloat(pd.rate) : 0
}

function commentClass(comments){
    try {
        if(!comments || comments.length === 0){
            return 'none'
        }

        if(comments.filter(comment => 'attachment' in comment).length > 0){
            return 'attachments'
        }

        return 'comments'

    } catch (error) {
        console.error(error.message)    
    }
}

async function createLeadSummary(leads){
    try {
        let agentLookup = await getAgents()
        return leads.reduce((obj, item) => {
            let agentId = item.agent.uid
            let agentName = agentLookup.filter(user => user.uid === agentId)[0].name
            obj[item.id] = {
                yearMonth: yearMonth(item.created),
                client: `${item.firstName} ${item.lastName}`,
                agent: {name: agentName, ...item.agent},
                address: `${item.address}, ${item.city}, ${item.state}`,
                comments: commentClass(item.comments),
                amount: leadAmount(item.autoPolicyDetails),
                stage: item.stage, 
                status: item.status,
                flags: []
            }
            return obj      
       },{}) 
    } catch (error) {
        console.log('createLeadSummary', error.message)
    }
}

async function createHeader(leads){
    try {
        return leads.reduce((obj, item) => {
           
            //if stage is missing add and seed
            if(!obj.header[item.stage]){
                obj.header[item.stage] = {
                    count: 1,
                    amount: leadAmount(item.autoPolicyDetails)
                }
            } else {
                //existing stage summaryize
                //if the stage is closed we only deal with status === 'won'
                if(item.stage !== 'Closed' || (item.stage === 'Closed' && item.status === 'Won')){
                    obj.header[item.stage].count ++
                    obj.header[item.stage].amount += leadAmount(item.autoPolicyDetails)
                }
            }
            return obj
        },{header:{}})
    } catch (error) {
        console.error(error.message)
    }

}


;(async () => {
   // await getLeads()
    
    let agencies = leadData.reduce((arr, item) => {
        if(arr.indexOf(item.agency) === -1 ){
            arr.push(item.agency)
        }
        return arr
    },[])
    let myAgency = agencies.filter( i => i === 'LnLlJE33MgXPRIPUfIZL')
    let leadSummary = myAgency.map(async agency => {
        let leads = leadData.filter(lead => lead.agency === agency)
        let header = await createHeader(leads)
        let summary = await createLeadSummary(leads)
        await db.collection(`agencies/${agency}/summaries`).doc('activeLeads').set(
            {...header,...summary}
        )
        return 1
    })
    
   
    //console.log(yearMonth(new Date("2020-01-05")))
})()
