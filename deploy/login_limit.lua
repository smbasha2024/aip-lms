-- One proxy process/thread owns this rolling window across both API workers.
-- State intentionally resets on proxy restart; multiple proxies need shared state.
local clients = {}
local count = 0
local next_cleanup = 0
local capacity = 10000

local function reject(txn, retry)
    txn:done(txn:reply({
        status = 429,
        headers = {
            ["content-type"] = {"application/json"},
            ["cache-control"] = {"no-store"},
            ["retry-after"] = {tostring(retry)}
        },
        body = '{"error":{"code":"LOGIN_RATE_LIMITED","message":"Too many sign-in attempts. Try again later.","details":null}}'
    }))
end

core.register_action("login-limit", {"http-req"}, function(txn)
    local clock = core.now()
    local now = clock.sec + clock.usec / 1000000
    if now >= next_cleanup then
        for ip, queue in pairs(clients) do
            if queue[#queue] <= now - 60 then
                clients[ip] = nil
                count = count - 1
            end
        end
        next_cleanup = now + 60
    end
    local ip = txn.sf:src()
    local queue = clients[ip]
    if queue == nil then
        if count >= capacity then
            reject(txn, 60)
            return
        end
        queue = {}
        clients[ip] = queue
        count = count + 1
    end
    while #queue > 0 and queue[1] <= now - 60 do
        table.remove(queue, 1)
    end
    if #queue >= 10 then
        reject(txn, math.max(1, math.ceil(60 - (now - queue[1]))))
        return
    end
    queue[#queue + 1] = now
end)
