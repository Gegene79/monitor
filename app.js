"use strict";
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var routes = require('./routes/index');
var cst = require('./common/constants');
var db = require('./common/db');
var filesync = require('./common/fsdbsync');
var monitor = require('./routes/api/monitor');
var gallery = require('./routes/api/gallery');
var proxymonitor = require('./routes/api/proxymonitor');
var proxynode = require('./routes/api/proxynode');
var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//app.use('/node/api',proxynode);
app.use('*/api',proxymonitor);
app.use('*/api/monitor', monitor);
app.use('*/api/gallery', gallery);
app.use('/monitor', express.static('public'));
app.use(cst.THUMBS_DIR, express.static(cst.THUMBS_DIR));

// Connect DB
db.connect(function(){
});

process.on( 'SIGINT', function() {
  console.log( "\nOn eteint tout apres ce SIGINT (Ctrl-C)" );
  // some other closing procedures go here
  process.exit();
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('404 - Not Found');
  err.status = 404;
  next(err);
});

//error handler
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  console.error(err);
  //res.contentType(req.get('content-type'));
  res.json(err);
});

module.exports = app;
