
/*
 * GET users listing.
 */

exports.list = function(req, res, next){
  res.send("respond with a resource");
  next()
};

exports.bundle = function(req, res, next) {
  files = [];

  var redis = require('redis');
  var client = redis.createClient();
  var multi = client.multi();

  client.smembers('bundle:'+req.params.id+':files', function(err, replies) {

    replies.forEach(function (reply, index) {
      multi.hmget(reply.toString(), "name")
    });

    multi.exec(function(err, replies) {
      replies.forEach(function (reply, index) {
        files.push(reply.toString());
      });
      res.render('bundle', {
        's3_host': ('http://s3.amazonaws.com/' + process.env.S3_BUCKET_NAME + '/' + req.params.id),
        'files': files });
    });
  });

};
