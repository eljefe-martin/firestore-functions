const functions = require('firebase-functions');
const admin = require('firebase-admin')
const fs = require('fs')


exports.onAddAgent = functions.firestore
    .document('agencies/{agencyId}/users/{userId}')
    .onCreate((change, context) => {
        console.log('context ', context)
        console.log('change ', change)
        console.log(change.data())
    })

exports.onSummarizeLeads = functions.https.onCall(async (data) => {
    try {
        const app = admin.initializeApp()
        if(!data) throw new functions.https.HttpsError(error.message)
        const db = admin.firestore()
        console.log(db._settings)
        const result = await summarizeLeads(db) 
        //clean up add
        app.delete()
        return result       
    } catch (error) {
        throw new functions.https.HttpsError(error.message)
    }
})

async function getAgents(db){
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

async function summarizeLeads(db){
        try {
            let result =[]
            let agentLookup = await getAgents(db)

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
                    yearMonth:monthYear(lead.created),
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
            return result
        } catch (error) {
            throw error
        }
    }
    