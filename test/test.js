"use strict";
var expect  = require("chai").expect;
var request = require("request");

let url = "http://localhost:3000/api/prueba_type/prueba_name";
let value = 20+Math.random()*10;


    describe("insert metric with value "+value+" using url "+url, function() {

        it("returns status 200", function(done) {
            var json = {
                value: value,
                period: 'm'
            };
            request.post({url:url, json: json}, function(err, resp, body) {
                if (err) {
                    console.error('post failed:', err);
                    done(err);
                }
                expect(resp.statusCode).to.equal(200);
                done();
            });
        });
    });
    
    describe("retrieve metric data using url "+url+"\n", function() {
        
        it("returns the correct value", function(done) {
            request.get(url+'/current', function(error, response, body) {
                expect(response.statusCode).to.equal(200);
                let resp = JSON.parse(response.body);
                console.log("value retrieved: "+resp[0].value);
                expect(resp[0].value).to.equal(value);
                done();
            });
        });
    });


    let url1 = "http://localhost:3000/node/api/prueba_type/prueba_name";
    let value1 = value+0.1;

    describe("insert metric with value "+value1+" using url "+url1, function() {
        
        it("returns status 200", function(done) {
            this.timeout(2000);
            setTimeout(function(){
            var json = {
                value: value1,
                period: 'm'
            };
            request.post({url:url1, json: json}, function(err, resp, body) {
                if (err) {
                    console.error('post failed:', err);
                    done(err);
                }
                expect(resp.statusCode).to.equal(200);
                done();
            });
            },1000);
        });
        
    });
   

    describe("retrieve metric data using url "+url1, function() {
        
        it("returns the correct value", function(done) {
            this.timeout(2000);
            setTimeout(function(){
            request.get(url1+'/current', function(error, response, body) {
                expect(response.statusCode).to.equal(200);
                let resp = JSON.parse(response.body);
                console.log("value retrieved: "+resp[0].value);
                expect(resp[0].value).to.equal(value1);
                done();
            });
            },1000);
        });
    });

        
    let url2 = "http://localhost:3000/api/monitor/prueba_type/prueba_name";
    let value2 = value+0.1;

    describe("insert metric with value "+value2+" using url "+url2, function() {
        it("returns status 200", function(done) {
            this.timeout(3000);
            setTimeout(function(){
            var json = {
                value: value2,
                period: 'm'
            };
            request.post({url:url2, json: json}, function(err, resp, body) {
                if (err) {
                    console.error('post failed:', err);
                    done(err);
                }
                expect(resp.statusCode).to.equal(200);
                done();
            });
            },2000);
        });
    });
    
    describe("retrieve metric data using url "+url2, function() {
        it("returns the correct value", function(done) {
            this.timeout(3000);
            setTimeout(function(){
            request.get(url+'/current', function(error, response, body) {
                expect(response.statusCode).to.equal(200);
                let resp = JSON.parse(response.body);
                console.log("value retrieved: "+resp[0].value);
                expect(resp[0].value).to.equal(value2);
                done();
            });
            },2000);
        });
    });
