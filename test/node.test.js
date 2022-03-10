const user = require("./users/axel669.json")
const { RealTime } = require("../node.js")

const all = RealTime({
    user,
    channel: "odatnurd",
    topics: [
        "channel-points-channel-v1"
    ]
})

all.on("connect", console.log)
all.on("channel-points-channel-v1", console.log)
all.on("chat.*", console.log)
all.connect().then(console.log)
