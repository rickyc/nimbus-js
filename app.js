//////////////////////////////
// Module dependencies.
//////////////////////////////
var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , upload = require('jquery-file-upload-middleware')
  , uuid = require('node-uuid');

var app = express();


//////////////////////////////
// Uploader
//////////////////////////////
upload.configure({
  uploadDir: __dirname + '/public/uploads',
  uploadUrl: '/uploads',
});

upload.on('begin', function(fileInfo) {
  console.log(fileInfo);
});

upload.on('end', function(fileInfo) {
  console.log(fileInfo);

  if (fileInfo.type == 'application/zip') {
    var AdmZip = require('adm-zip');

    var id = fileInfo.url.match(/\/uploads\/(.*)\//)[1]

    var zip = new AdmZip(__dirname + '/public/uploads/' + id + '/' + fileInfo.name);
    var zipEntries = zip.getEntries();


    var client = require('knox').createClient({
      key: process.env.S3_ACCESS_KEY_ID,
      secret: process.env.S3_SECRET_ACCESS_KEY,
      bucket: process.env.S3_BUCKET_NAME
    });

    zipEntries.forEach(function(zipEntry) {
      console.log(zipEntry.toString());
      var decompressedData = zip.readFile(zipEntry);
      console.log(decompressedData);
      var headers = { 'Content-Type': 'text/plain' }
      console.log(zipEntry.entryName);
      client.putBuffer(decompressedData, "/" + id + "/" + zipEntry.entryName.replace(/ /g, '%20'), headers, function(err, res) { });
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


//////////////////////////////
// Application Start
//////////////////////////////
http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
