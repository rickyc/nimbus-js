//////////////////////////////
// Module dependencies.
//////////////////////////////
var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , upload = require('jquery-file-upload-middleware')
  , uuid = require('node-uuid')
  , redis = require('redis');

var app = express();


//////////////////////////////
// Uploader
//////////////////////////////
upload.configure({
  uploadDir: __dirname + '/public/uploads',
  uploadUrl: '/uploads',
});

upload.on('begin', function(fileInfo) {
  //console.log(fileInfo);
});

upload.on('end', function(fileInfo) {
  console.log(fileInfo);

  if (fileInfo.type == 'application/zip') {
    var AdmZip = require('adm-zip');

    var id = fileInfo.url.match(/\/uploads\/(.*)\//)[1]
    var redis_client = redis.createClient();
    redis_client.hmset("bundle:" + id, { 'created_at': (new Date).getTime() }, redis.print);

    var zip = new AdmZip(__dirname + '/public/uploads/' + id + '/' + fileInfo.name);
    var zipEntries = zip.getEntries();


    var knox_client = require('knox').createClient({
      key: process.env.S3_ACCESS_KEY_ID,
      secret: process.env.S3_SECRET_ACCESS_KEY,
      bucket: process.env.S3_BUCKET_NAME
    });

    zipEntries.forEach(function(zipEntry) {
      //console.log(zipEntry.toString());
      var decompressedData = zip.readFile(zipEntry);
      //console.log(decompressedData);
      var headers = { 'Content-Type': 'text/plain' }
      //console.log(zipEntry.entryName);
      redis_client.incr('file_id', redis.print)
      redis_client.get('file_id', function(err, reply) {
        var file_id = reply.toString()
        console.log("file_id: " + file_id);
        var name = zipEntry.entryName.replace(/ /g, '%20')
        knox_client.putBuffer(decompressedData, "/" + id + "/" + name, headers, function(err, res) { });
        redis_client.hmset("file:" + file_id, { 'name': name });
        redis_client.sadd("bundle:" + id + ":files", "file:"+file_id);
      });
    });
  }
});


//////////////////////////////
// Environment Configuration
//////////////////////////////
app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));

  app.use('/upload', function (req, res, next) {
    id = uuid.v1();
    upload.fileHandler({
      uploadDir: function () {
        return __dirname + '/public/uploads/' + id
      },
      uploadUrl: function () {
        return '/uploads/' + id
      }
    })(req, res, function() {
      return { 'id': id, 'bucket': process.env.S3_BUCKET_NAME };
    });
  });

  app.use('/list', function (req, res, next) {
    upload.fileManager({
      uploadDir: function () {
        return __dirname + '/public/uploads/' + req.sessionID
      },
      uploadUrl: function () {
        return '/uploads/' + req.sessionID
      }
    }).getFiles(function (files) {
      res.json(files);
    });
  });

  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});


// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}


//////////////////////////////
// Routes
//////////////////////////////
app.get('/', routes.index);
app.get('/users', user.list);
app.get('/:id', user.bundle);


//////////////////////////////
// Application Start
//////////////////////////////
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
