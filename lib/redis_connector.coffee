RedisConnector =

  client: ->
    return if (process.env.REDISTOGO_URL)
      rtg = require('url').parse(process.env.REDISTOGO_URL)
      redis = require('redis').createClient(rtg.port, rtg.hostname)
      redis.auth(rtg.auth.split(':')[1])
      redis
    else
      require('redis').createClient()

module.exports = RedisConnector
