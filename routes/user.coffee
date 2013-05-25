exports.list = (req, res, next) ->
  res.send 'respond with a resource'
  next()

exports.bundle = (req, res, next) ->
  files  = []
  redis  = require 'redis'
  client = redis.createClient()
  multi  = client.multi()

  client.smembers "bundle:#{req.params.id}:files", (err, replies) ->
    replies.forEach (reply, index) -> multi.hmget reply.toString(), 'name'

    multi.exec (err, replies) ->
      replies.forEach (reply, index) ->
        files.push reply.toString()

      res.render 'bundle',
        s3_host: "http://s3.amazonaws.com/#{process.env.S3_BUCKET_NAME}/#{req.params.id}"
        files: files
