# Axel669's Twitch Lib

Simple library for doing things with twitch chat and pubsub thats made for the
browser.

## Installation

### yarn/npm
```
yarn add @axel669/twitch
```

### Browser
Either use a bundler and normal node imports, or the following script tag
```html
<script src="https://cdn.jsdelivr.net/npm/@axel669/dist/twitch.js"></script>
```

## Usage

### Require
```js
const {Chat, Pubsub, RealTime} = require("@axel669/twitch")
```

### Import
```js
import {Chat, Pubsub, RealTime} from "@axel669/twitch/esm"
```

### Browser
> If the cdn script tag is used
```js
twitch.Chat(...)
twitch.Pubsub(...)
twitch.RealTime(...)
```

## Events
Library uses [EventBridge](https://github.com/axel669/event-bridge) to
manage events, see there for more details about how listeners work. All of the
objects created pass the `on` functions from the internal bridge it uses.

## Chat API
```js
import {Chat} from "@axel669/twitch"

const chat = Chat({
    user: {
        name: "<username>",
        token: "<oauth token>",
    },
    channel: "<channel>"
})

chat.on(
    "chat",
    ({ data }) => console.log(data.tags.displayName, data.message)
)
chat.on(
    "bits",
    ({ data }) => console.log(data.tags.displayName, "gave", data.tags.bits)
)
chat.on(
    "sub",
    ({ data }) => console.log("sub", data)
)
await chat.connect()
await chat.say("message")
await chat.say("reply thread", "<msg id replied to>")
chat.disconnect()
```

### Chat Event List
> This is a list of the events that are currently parsed and sorted through.
> There are still some irc commands it doesn't parse (I didn't really see a
> reason to, but I'm also lazy), and those can be captured with the `*` event.
> Those events will always be full caps like the commands.
- system - System messages that come through the socket (I got pretty lazy about
    parsing these)
- ping - Twitch sends a ping every few minutes, the library automatically sends
    back the poing message expected to keep the connection alive, but you can
    use this event to do something custom as well
- chat.redeem - any *custom* redeem that has text attached to it
- chat.message - any chat message that comes through that isn't a sub-based
    event (including redeems that have a chat message attached)
    **NOTE: highlighted message redeems come through here with the tag
    `msgID` set to `"highlighted-message"`**
- join/part - Sent when users are marked as joining or leaving a chat. These
    are not guaranteed to happen immediately but could be used to keep track of
    an approximate user list.
- raid/unraid - Start or cancelled raids
- sub.new - New subscription to the channel
- sub.resub - Resubs
- sub.gift - When someone is given a gift sub from a user
- sub.gift.anon - Gift sub from anon user
- sub.gift.mystery - This event is fired when someone gifts to the community.
    The individual recipients will each get a `sub.gift` or `sub.gift.anon`.
- sub.upgrade - User continues a gifted sub
- sub.upgrade.anon - User continues a gift sub from an anon user

## Pubsub API
```js
const pubsub = twitchComm.Pubsub({
    user: {
        id: "<user id>",
        token: "<oauth token>"
    },
    topics: [
        "channel-points-channel-v1"
    ]
})
pubsub.on(
    "channel-points-channel-v1",
    ({ data }) => console.log(data.redemption.reward.title)
)
await pubsub.connect()
//  some time later
pubsub.disconnect()
```

### Event List
The `Pubsub` will fire events based on the topics passed into the object on
creation. it will fire an event with the type of the topic without any of the
IDs attached. A full list of the pubsub topics and message data can be found
[Here](https://dev.twitch.tv/docs/pubsub).

## RealTime API
The `RealTime` function takes the `user`, `token`, and `topics` properties
from the `Chat` and `Pubsub` functions and instantiates both of them internally.
It fires events from both of them, and its `connect` and `disconnect`
functions trigger for both internal objects. It also passes the `say` function
from the `Chat` object.
```js
const realTime = twitchComm.RealTime({
    user {
        name: "<username>",
        id: "<user id>",
        token: "<oauth token>"
    },
    channel: "<channel>",
    topics: [
        "channel-points-channel-v1"
    ]
})

realTime.on("channel-points-channel-v1", console.log)
realTime.on("chat.message", console.log)

//  returns an array of [chat connection result, pubsub connection result]
await realTime.connect()
await realTime.say("message")
await realTime.say("reply thread", "<msg id replied to>")
realTime.disconnect()
```
