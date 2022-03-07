# Twitch Chat

Simple library for doing things with twitch chat thats made for the browser.

## API
```js
const chat = Chat({
    user: {
        name: "<username>",
        pass: "<oauth password>",
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
chat.say("message")
chat.say("reply thread", "<msg id replied to>")
chat.disconnect()
```

## Events
Library uses [EventBridge](https://github.com/axel669/event-bridge) to
manage events, see there for more details about how listeners work. The `Chat`
object passes the `on` and `forward` functions from the internal bridge it uses.

### Event List
> This is a list of the events that are currently parsed and sorted through.
> There are still some irc commands it doesn't parse (I didn't really see a
> reason to, but I'm also lazy), and those can be captured with the `*` event.
> Those events will always be full caps like the commands.
- system - System messages that come through the socket (I got pretty lazy about
    parsing these)
- ping - Twitch sends a ping every few minutes, the library automatically sends
    back the poing message expected to keep the connection alive, but you can
    use this event to do something custom as well
- chat - any chat message that comes through that isn't a sub-based event
    (including redeems that have a chat message attached)
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
