import {request} from "./request.js"

const one = (func) =>
    async (...args) => {
        const result = await func(...args)

        if (result instanceof Error) {
            return result
        }

        return result.data[0]
    }

const api = (options) => {
    const {user, clientID} = options

    const headers = {
        "Client-Id": clientID,
        "Authorization": `Bearer ${user.token}`,
        "Content-Type": "application/json",
    }
    return {
        polls: {
            TERMINATED: "TERMINATED",
            ARCHIVED: "ARCHIVED",
            find: one(
                (id) => request({
                    path: "/polls",
                    headers,
                    params: {
                        id,
                        broadcaster_id: user.id,
                    }
                })
            ),
            list: (after, first) => request({
                path: "/polls",
                headers,
                params: {
                    broadcaster_id: user.id,
                    after,
                    first,
                }
            }),
            create: one(
                (pollInfo) => request({
                    path: "/polls",
                    headers,
                    data: {
                        ...pollInfo,
                        broadcaster_id: user.id
                    },
                })
            ),
            end: one(
                (id, status) => request({
                    path: "/polls",
                    type: "PATCH",
                    headers,
                    data: {
                        status,
                        id,
                        broadcaster_id: user.id,
                    },
                })
            )
        }
    }
}

export default api
