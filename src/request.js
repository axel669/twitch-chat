let fetch = null
const initReq = (fetchFunc) => fetch = fetchFunc

const cleanParams = (paramSource = {}) => {
    const params = new URLSearchParams(
        Object.fromEntries(
            Object.entries(paramSource)
                .filter(p => p[1] !== undefined)
        )
    )

    return params.toString()
}

const baseURL = "https://api.twitch.tv/helix"
const request = async (options) => {
    const {
        path,
        headers,
        data,
        params,
        type,
    } = options

    const hasData = data !== undefined
    const method = type ?? (hasData ? "POST" : "GET")
    const body = hasData ? JSON.stringify(data) : undefined
    const fetchOptions = { method, headers, body }

    const paramString = cleanParams(params)
    const url = `${baseURL}${path}?${paramString}`

    const response = await fetch(url, fetchOptions)

    if (response.ok === false) {
        return new Error(`${response.status}: ${response.statusText}`)
    }

    return await response.json()
}

export { initReq, request }
