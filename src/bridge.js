const pathList = (type) => type.split(".").reduce(
    (list, part) => {
        if (list.length === 0) {
            return [part, "*"]
        }

        const parent = list[0]
        list.unshift(
            `${parent}.${part}`,
            `${parent}.*`
        )
        return list
    },
    []
)

const Bridge = () => {
    const handlers = {}

    const on = (type, handler) => {
        handlers[type] = [
            ...(handlers[type] ?? []),
            handler
        ]

        return () => {
            if (handlers[type] === undefined) {
                return
            }
            handlers[type] = handlers[type].filter(
                h => h !== handler
            )
        }
    }
    const once = (type, handler) => {
        let called = false
        const wrapped = (evt) => {
            if (called) {
                return
            }
            called = true
            unsub()
            handler(evt)
        }
        const unsub = on(type, wrapped)
    }

    const fire = async (type, data) => {
        const evt = {type, data}

        const paths = pathList(type)

        for (const path of paths) {
            for (const handler of handlers[path] ?? []) {
                queueMicrotask(
                    () => handler(evt)
                )
            }
        }
    }

    const removeAll = () => {
        for (const key of Object.keys(handlers)) {
            delete handlers[key]
        }
    }

    return {
        on,
        once,
        fire,
        removeAll,
    }
}

export default Bridge
