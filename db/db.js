var mongoose = require('mongoose');
var db = mongoose.connection;
var Schema = mongoose.Schema;
var URL = 'mongodb://petitbilly/dbmetric';

var Metric = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  period: { type: String, default: 'm' },
  value:   Number,
  min: Number,
  max: Number,
  avg: Number,
  timestamp: { type: Date, default: Date.now },
  loaded: {type: Date, default: Date.now}
});

var MetricModel = mongoose.model('Metric', Metric);

exports.Metric = MetricModel;

exports.connect = function(){
    mongoose.connect(URL);
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
    // we're connected!
    console.log("connectado!")
    });
};

exports.insertMetric = function(metric, callback) {
	
    var a = new MetricModel();
    a.name = metric.name;
    a.type = metric.type;
    if (metric.period) {
        a.period = metric.period;
    } else {
        a.period = 'm';
    }
    if (metric.ts){
        a.timestamp = metric.ts;
    } else {
        a.timestamp = Date.now();
    }
    a.value = metric.value;
    a.min = metric.min;
    a.max = metric.max;
    a.avg = metric.avg;
    
    a.loaded = Date.now();

	a.save(function(err) {
		if (err) {
			console.log(err);
            //return null;
			throw err;
		}
		return callback(Metric._id);
	});
}