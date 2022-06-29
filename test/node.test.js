const user = require("./users/axel669.json")
const { RealTime, API } = require("../node.js")

const api = API({
    user,
    clientID: "mrz3t77h5octc2glld7a2qaw8vuo7q",
})

api.polls.list().then(console.log)

// const all = RealTime({
//     user,
//     channel: "odatnurd",
//     topics: [
//         "channel-points-channel-v1"
//     ]
// })

// all.on("connect", console.log)
// all.on("channel-points-channel-v1", console.log)
// all.on("*", console.log)
// all.connect().then(console.log)
