var express = require('express');
var router = express.Router();
var db = require('../db/db');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile('dashboard.html');
});

module.exports = router;
