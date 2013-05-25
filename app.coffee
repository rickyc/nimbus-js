#////////////////////////////
# Module dependencies.
#////////////////////////////
express = require('express')
routes  = require('./routes')
user    = require('./routes/user')
http    = require('http')
path    = require('path')
upload  = require('jquery-file-upload-middleware')
uuid    = require('node-uuid')
redis   = require('redis')


app = express()


#////////////////////////////
# Uploader
#////////////////////////////
upload.configure
  uploadDir: __dirname + '/public/uploads'
  uploadUrl: '/uploads'

upload.on 'end', (fileInfo) ->
  if fileInfo.type is 'application/zip'
    AdmZip = require('adm-zip')
    id = fileInfo.url.match(/\/uploads\/(.*)\//)[1]

    redis_client = redis.createClient()
    redis_client.hmset "bundle:#{id}",
      created_at: (new Date).getTime()
    , redis.print

    zip = new AdmZip("#{__dirname}/public/uploads/#{id}/#{fileInfo.name}")
    zipEntries = zip.getEntries()

    knox_client = require('knox').createClient
      key: process.env.S3_ACCESS_KEY_ID
      secret: process.env.S3_SECRET_ACCESS_KEY
      bucket: process.env.S3_BUCKET_NAME

    zipEntries.forEach (zipEntry) ->
      decompressedData = zip.readFile(zipEntry)
      headers = 'Content-Type': 'text/plain'

      redis_client.incr 'file_id', redis.print
      redis_client.get 'file_id', (err, reply) ->
        file_id = reply.toString()
        name = zipEntry.entryName.replace(RegExp(" ", "g"), "%20")
        knox_client.putBuffer decompressedData, "/#{id}/#{name}", headers, (err, res) ->

        redis_client.hmset "file:#{file_id}", name: name
        redis_client.sadd "bundle:#{id}:files", "file:#{file_id}"




#////////////////////////////
# Environment Configuration
#////////////////////////////
app.configure ->
  app.set 'port', process.env.PORT or 3000
  app.set 'views', __dirname + '/views'
  app.set 'view engine', 'jade'
  app.use express.favicon()
  app.use express.logger('dev')
  app.use '/upload', (req, res, next) ->
    id = uuid.v1()
    upload.fileHandler(
      uploadDir: -> "#{__dirname}/public/uploads/#{id}"
      uploadUrl: -> "/uploads/#{id}"
    ) req, res, ->
      id: id
      bucket: process.env.S3_BUCKET_NAME

  app.use '/list', (req, res, next) ->
    upload.fileManager(
      uploadDir: -> "#{__dirname}/public/uploads/#{req.sessionID}"
      uploadUrl: -> "/uploads/#{req.sessionID}"
    ).getFiles (files) ->
      res.json files

  app.use express.bodyParser()
  app.use express.methodOverride()
  app.use express.cookieParser('your secret here')
  app.use express.session()
  app.use app.router
  app.use require('stylus').middleware(__dirname + '/public')
  app.use express.static(path.join(__dirname, 'public'))


# development only
app.use express.errorHandler()  if 'development' is app.get('env')

#////////////////////////////
# Routes
#////////////////////////////
app.get '/',        routes.index
app.get '/users',   user.list
app.get '/:id',     user.bundle

#////////////////////////////
# Application Start
#////////////////////////////
http.createServer(app).listen app.get('port'), ->
  console.log 'Express server listening on port ' + app.get('port')
