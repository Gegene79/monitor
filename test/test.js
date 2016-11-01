
var expect  = require("chai").expect;
var request = require("request");

describe("metric API", function() {

    var url = "http://localhost:3000/api/monitor/prueba_type/prueba_name";
    var value = 20+Math.random()*10;

    describe("insert metric", function() {

        it("returns status 200", function(done) {
            var json = {
                value: value,
                period: 'm'
            };
            request.post({url:url, json: json}, function optionalCallback(err, httpResponse, body) {
                if (err) {
                    return console.error('post failed:', err);
                }
                expect(httpResponse.statusCode).to.equal(200);
                done();
            });

        });

        /*
        it("effectively inserted the metric into mongo", function() {

        });
        */
    });

    describe("retrieve metric data", function() {

        it("returns status 200", function(done) {
            request(url+'/current', function(error, response, body) {
                console.log(response.body);
                expect(response.statusCode).to.equal(200);
                expect(response.body.value).to.equal(value);
                done();
            });
        });

    }); 

});