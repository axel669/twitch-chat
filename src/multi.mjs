import EventBridge from "@axel669/event-bridge/esm"

const Multi = (options) => {
    const { connectors } = options

    const multiband = EventBridge()
    const bridges = connectors.map(
        connector => connector(options)
    )
    const failed = bridges.find(bridge => bridge instanceof Error)
    if (failed !== undefined) {
        return failed
    }

    const connect = () => Promise.all(
        bridges.map(bridge => bridge.connect())
    )
    const disconnect = () => Promise.all(
        bridges.map(bridge => bridge.disconnect())
    )

    const channels = bridges.map(
        bridge => multiband.pull(bridge)
    )
    const stop = () => channels.forEach(
        stop => stop()
    )

    const interfaces = bridges.reduce(
        (itf, bridge) => {
            const { on, connect, disconnect, ...intrface } = bridge
            for (const [name, func] of Object.entries(intrface)) {
                itf[name] = func
            }
            return itf
        },
        {}
    )

    return {
        ...interfaces,
        on: multiband.on,
        connect,
        disconnect,
        stop,
    }
}

export default Multi
